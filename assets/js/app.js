/**
 * App Controller
 * Main SPA router, state management, and orchestration
 * Grace College Question Paper Generator
 */
const App = {
    // =============================================
    // Global State
    // =============================================
    state: {
        id: null,
        regulation: '21',
        exam_type: 'Internal Assessment-I',
        degree: 'B.Tech',
        programme: 'Artificial Intelligence and Data Science',
        course_code: '',
        course_name: '',
        year: '',
        semester: '',
        exam_date: '',
        duration: '1 1/2 hrs',
        max_marks: 50,
        status: 'draft',
        questions: [],
        created_at: null,
        updated_at: null
    },

    currentPage: 'dashboard',
    autoSaveTimer: null,
    autoSaveInterval: 30000, // 30 seconds

    // =============================================
    // Initialization
    // =============================================
    init() {
        this.state.regulation = '21';
        this.state.degree = 'B.Tech';
        this.state.programme = 'Artificial Intelligence and Data Science';
        this.state.duration = '1 1/2 hrs';

        // Check for hash-based navigation
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        this.navigate(hash);

        // Load current paper if exists
        const currentPaper = Storage.loadCurrentPaper();
        if (currentPaper) {
            this.loadState(currentPaper);
        } else {
            this.initDefaultQuestions();
        }

        // Ensure regulation structure is strictly enforced (e.g. 21 Part C has 8a & 8b)
        this.ensureRegulationStructure();

        // Set max marks
        this.updateMaxMarks();

        // Update regulation toggles
        this.updateRegulationToggles();

        // Update dashboard stats
        this.updateDashboardStats();

        // Sync with Database (Local or Cloud)
        Storage.syncWithDatabase().then(() => {
            this.updateDashboardStats();
            if (this.currentPage === 'saved') {
                Storage.filterPapers();
            }
        });

        // Start auto-save
        this.startAutoSave();

        // Apply settings to fields
        this.applyFieldValues();

        // Window print listener to guarantee preview is rendered before printing
        window.addEventListener('beforeprint', () => {
            Preview.render(this.getCurrentPaperData());
            const previewEl = document.getElementById('page-preview');
            if (previewEl) previewEl.classList.add('active');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.savePaper();
            }
        });

        console.log('✅ Grace College Question Paper Generator initialized');
    },

    // =============================================
    // Navigation
    // =============================================
    navigate(page) {
        this.currentPage = page;
        window.location.hash = page;

        // Update page sections visibility
        document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) pageEl.classList.add('active');

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });
        document.querySelectorAll('.bottom-nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });

        // Update page title
        const titles = {
            dashboard: ['Dashboard', 'Welcome to Question Paper Generator'],
            create: ['Create Paper', 'Build your question paper'],
            preview: ['Preview', 'A4 preview of your question paper'],
            saved: ['Saved Papers', 'View and manage your saved papers'],
            settings: ['Regulations & Settings', 'Configure examination regulations and templates'],
            help: ['Help', 'How to use the Question Paper Generator']
        };
        const [title, subtitle] = titles[page] || ['', ''];
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageSubtitle').textContent = subtitle;

        // Close sidebar on mobile
        this.closeSidebar();

        // Render page-specific content
        this.renderPage(page);
    },

    renderPage(page) {
        switch (page) {
            case 'dashboard':
                this.updateDashboardStats();
                this.renderRecentPapers();
                this.updateRegulationToggles();
                break;
            case 'create':
                this.ensureRegulationStructure();
                this.updateMaxMarks();
                this.updateRegulationToggles();
                this.applyFieldValues();
                this.updateDetailsValidation();
                QuestionBuilder.init(this.state.regulation);
                setTimeout(() => {
                    QuestionBuilder.initEditors();
                    this.updatePreview();
                }, 150);
                this.validateAndDisplay();
                this.updatePreview();
                this.updateFabVisibility();
                break;
            case 'preview':
                this.ensureRegulationStructure();
                this.updatePreview();
                break;
            case 'saved':
                Storage.filterPapers();
                break;
            case 'settings':
                this.renderSettingsPage();
                break;
        }
    },

    refreshCurrentPage() {
        this.renderPage(this.currentPage);
    },

    // =============================================
    // Regulation Toggle
    // =============================================
    setRegulation(reg, force = false) {
        if (this.state.regulation === reg && !force) {
            this.ensureRegulationStructure();
            if (this.currentPage === 'create') {
                QuestionBuilder.init(reg);
                setTimeout(() => {
                    QuestionBuilder.initEditors();
                    this.updatePreview();
                }, 150);
                this.validateAndDisplay();
                this.updatePreview();
            } else if (this.currentPage === 'preview') {
                this.updatePreview();
            }
            return;
        }

        // Warn if questions exist
        if (this.state.questions.length > 0 &&
            this.state.questions.some(q => q.question_text && q.question_text.trim() && q.question_text !== '<p><br></p>')) {
            if (!confirm(`Switching to ${reg} Regulation will reset questions. Continue?`)) return;
        }

        this.state.regulation = reg;
        this.updateMaxMarks();
        this.updateRegulationToggles();
        this.initDefaultQuestions();
        this.ensureRegulationStructure();

        if (this.currentPage === 'create') {
            QuestionBuilder.init(reg);
            setTimeout(() => {
                QuestionBuilder.initEditors();
                this.updatePreview();
            }, 150);
            this.validateAndDisplay();
            this.updatePreview();
        } else if (this.currentPage === 'preview') {
            this.updatePreview();
        }

        this.triggerAutoSave();
    },

    getAllRegulations() {
        const builtIn = [
            { code: '21', name: '21 REGULATION', totalMarks: 50, maxUnits: 5, maxCO: 5, isBuiltIn: true, description: 'Part A (5×2), Part B (2×16 OR), Part C (1×8 OR)' },
            { code: '25', name: '25 REGULATION', totalMarks: 50, maxUnits: 7, maxCO: 7, isBuiltIn: true, description: 'Part A (5×1 MCQs), Part B (3×3), Part C (3×12 OR)' }
        ];
        const custom = (typeof Storage !== 'undefined' && Storage.getCustomRegulations)
            ? Storage.getCustomRegulations().map(r => ({ ...r, isBuiltIn: false }))
            : [];
        return [...builtIn, ...custom];
    },

    updateRegulationToggles() {
        const regs = this.getAllRegulations();
        document.querySelectorAll('.regulation-toggle').forEach(container => {
            container.innerHTML = regs.map(r => `
                <button class="reg-toggle-btn ${String(r.code) === String(this.state.regulation) ? 'active' : ''}"
                    data-reg="${r.code}" onclick="App.setRegulation('${r.code}')">
                    ${(r.name || r.code + ' REGULATION').toUpperCase()}
                </button>
            `).join('');
        });
    },

    updateMaxMarks() {
        const template = this.getTemplate();
        this.state.max_marks = template.totalMarks;
        const field = document.getElementById('fieldMaxMarks');
        if (field) field.value = template.totalMarks;
    },

    getTemplate(regCode) {
        const code = String(regCode || this.state.regulation || '21');
        if (code === '21') return REGULATION_21;
        if (code === '25') return REGULATION_25;

        // Check for custom regulation
        if (typeof Storage !== 'undefined' && Storage.getCustomRegulation) {
            const custom = Storage.getCustomRegulation(code);
            if (custom) {
                return this.createDynamicTemplate(custom);
            }
        }
        return REGULATION_21;
    },

    createDynamicTemplate(customReg) {
        const sections = (customReg.sections || []).map(sec => {
            const count = parseInt(sec.questionsCount) || 1;
            const marksEach = parseInt(sec.marksEach) || 1;
            const totalMarks = sec.totalMarks ? parseInt(sec.totalMarks) : (count * marksEach);
            const questionTypes = sec.allowMCQ ? ['mcq', 'descriptive'] : ['descriptive'];
            return {
                part: sec.part || 'A',
                title: sec.title || `PART – ${sec.part}`,
                subtitle: sec.subtitle || `(${count} × ${marksEach} = ${totalMarks} Marks)`,
                questionsCount: count,
                marksEach: marksEach,
                totalMarks: totalMarks,
                allowOR: !!sec.allowOR,
                allowSubQuestions: !!sec.allowSubQuestions,
                fixedMarks: true,
                questionTypes: questionTypes,
                description: sec.description || (sec.allowOR ? 'Answer ALL Questions (Internal Choice)' : 'Answer ALL Questions')
            };
        });

        const totalMarks = parseInt(customReg.totalMarks) || sections.reduce((sum, s) => sum + s.totalMarks, 0);

        let currentStart = 1;
        const questionNumbering = {};
        sections.forEach(sec => {
            questionNumbering[sec.part] = { start: currentStart, format: 'numeric' };
            currentStart += sec.questionsCount;
        });

        return {
            name: customReg.name || `${customReg.code} Regulation`,
            code: String(customReg.code),
            totalMarks: totalMarks,
            maxUnits: parseInt(customReg.maxUnits) || 5,
            maxCO: parseInt(customReg.maxCO) || 5,
            sections: sections,
            tableColumns: ['Q. No', 'Question', 'CO-K Level', 'Max. Marks'],
            questionNumbering: questionNumbering,
            orFormat: { labels: ['(a)', '(b)'], separator: 'OR' },
            subQuestionFormat: { labels: ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)'] },
            pdfLayout: {
                headerLines: [
                    { text: 'GRACE COLLEGE OF ENGINEERING', style: 'collegeName' },
                    { text: '(Approved by AICTE, New Delhi & Affiliated to ANNA UNIVERSITY, Chennai)', style: 'subtitle' },
                    { text: 'Mullakkadu, THOOTHUKUDI – 05', style: 'location' }
                ],
                showRegNoBoxes: true,
                regNoBoxCount: 12,
                footer: {
                    columns: [
                        { label: 'Prepared By', line: true },
                        { label: 'Course Coordinator', line: true },
                        { label: 'Verified By IQAC', line: true },
                        { label: 'Approved By HoD', line: true }
                    ]
                },
                margins: { top: 8, right: 10, bottom: 8, left: 10 }
            },
            getDefaultQuestions() {
                const questions = [];
                let qCounter = 1;
                sections.forEach((section) => {
                    for (let i = 0; i < section.questionsCount; i++) {
                        const qNum = qCounter++;
                        const parentId = 'q_' + Date.now() + '_' + section.part + '_' + i;
                        const defaultUnit = 'Unit ' + Math.min(i + 1, customReg.maxUnits || 5);
                        const defaultCO = 'CO' + Math.min(i + 1, customReg.maxCO || 5);
                        const defaultK = section.marksEach <= 2 ? 'K1' : (section.marksEach <= 8 ? 'K2' : 'K3');

                        if (section.allowOR) {
                            questions.push({
                                id: parentId,
                                part: section.part,
                                question_number: qNum,
                                question_text: '',
                                question_type: 'descriptive',
                                marks: section.marksEach,
                                co: defaultCO,
                                unit: defaultUnit,
                                k_level: defaultK,
                                image_path: null,
                                image_alignment: 'center',
                                image_size: 'medium',
                                image_width: null,
                                image_height: null,
                                parent_id: null,
                                or_group: null,
                                sub_number: null,
                                sort_order: qNum,
                                mcq_options: null,
                                children: [
                                    {
                                        id: parentId + '_a',
                                        parent_id: parentId,
                                        part: section.part,
                                        question_number: qNum,
                                        or_group: 'a',
                                        sub_number: null,
                                        question_text: '',
                                        marks: section.marksEach,
                                        co: defaultCO,
                                        unit: defaultUnit,
                                        k_level: defaultK,
                                        image_path: null,
                                        sort_order: 1
                                    },
                                    {
                                        id: parentId + '_b',
                                        parent_id: parentId,
                                        part: section.part,
                                        question_number: qNum,
                                        or_group: 'b',
                                        sub_number: null,
                                        question_text: '',
                                        marks: section.marksEach,
                                        co: defaultCO,
                                        unit: defaultUnit,
                                        k_level: defaultK,
                                        image_path: null,
                                        sort_order: 2
                                    }
                                ]
                            });
                        } else {
                            const isMCQ = section.questionTypes && section.questionTypes.includes('mcq') && !section.questionTypes.includes('descriptive');
                            questions.push({
                                id: parentId,
                                part: section.part,
                                question_number: qNum,
                                question_text: '',
                                question_type: isMCQ ? 'mcq' : 'descriptive',
                                marks: section.marksEach,
                                co: defaultCO,
                                unit: defaultUnit,
                                k_level: defaultK,
                                image_path: null,
                                image_alignment: 'center',
                                image_size: 'medium',
                                image_width: null,
                                image_height: null,
                                parent_id: null,
                                or_group: null,
                                sub_number: null,
                                sort_order: qNum,
                                mcq_options: isMCQ ? [{label:'A',text:''},{label:'B',text:''},{label:'C',text:''},{label:'D',text:''}] : null,
                                children: []
                            });
                        }
                    }
                });
                return questions;
            }
        };
    },

    // =============================================
    // Questions & Structure Enforcement
    // =============================================
    initDefaultQuestions() {
        const template = this.getTemplate();
        this.state.questions = template.getDefaultQuestions();
    },

    ensureRegulationStructure() {
        const reg = String(this.state.regulation || '21');
        if (!this.state.questions || this.state.questions.length === 0) {
            this.initDefaultQuestions();
            return;
        }

        if (reg === '21') {
            // Part A: 5 questions (1-5)
            const partAQs = this.state.questions.filter(q => q.part === 'A' && !q.parent_id);
            if (partAQs.length < 5) {
                for (let i = partAQs.length + 1; i <= 5; i++) {
                    this.state.questions.push({
                        id: 'q_' + Date.now() + '_' + i,
                        part: 'A',
                        question_number: i,
                        question_text: '',
                        question_type: 'descriptive',
                        marks: 2,
                        co: 'CO' + Math.min(i, 6),
                        unit: 'Unit ' + Math.min(i, 5),
                        k_level: 'K1',
                        image_path: null,
                        image_alignment: 'center',
                        image_size: 'medium',
                        image_width: null,
                        image_height: null,
                        parent_id: null,
                        or_group: null,
                        sub_number: null,
                        sort_order: i,
                        mcq_options: null,
                        children: []
                    });
                }
            }

            // Part B: 2 questions (6, 7) with OR children
            const partBQs = this.state.questions.filter(q => q.part === 'B' && !q.parent_id);
            for (let i = 0; i < 2; i++) {
                const qNum = 6 + i;
                let q = partBQs[i];
                if (!q) {
                    const parentId = 'q_' + Date.now() + '_b' + i;
                    q = {
                        id: parentId,
                        part: 'B',
                        question_number: qNum,
                        question_text: '',
                        question_type: 'descriptive',
                        marks: 16,
                        co: 'CO' + (i + 1),
                        unit: 'Unit ' + (i + 1),
                        k_level: 'K3',
                        image_path: null,
                        image_alignment: 'center',
                        image_size: 'medium',
                        image_width: null,
                        image_height: null,
                        parent_id: null,
                        or_group: null,
                        sub_number: null,
                        sort_order: qNum,
                        mcq_options: null,
                        children: []
                    };
                    this.state.questions.push(q);
                }
                q.question_number = qNum;
                q.marks = 16;
                const hasOrA = q.children && q.children.some(c => c.or_group === 'a');
                const hasOrB = q.children && q.children.some(c => c.or_group === 'b');
                if (!hasOrA || !hasOrB) {
                    const textA = (q.children && q.children.find(c => c.or_group === 'a')?.question_text) || q.question_text || '';
                    const textB = (q.children && q.children.find(c => c.or_group === 'b')?.question_text) || '';
                    q.children = [
                        {
                            id: q.id + '_a',
                            part: 'B',
                            question_number: qNum,
                            question_text: textA,
                            question_type: 'descriptive',
                            marks: 16,
                            co: q.co || ('CO' + (i + 1)),
                            unit: q.unit || ('Unit ' + (i + 1)),
                            k_level: 'K3',
                            parent_id: q.id,
                            or_group: 'a',
                            sub_number: null,
                            sort_order: 0,
                            children: []
                        },
                        {
                            id: q.id + '_b',
                            part: 'B',
                            question_number: qNum,
                            question_text: textB,
                            question_type: 'descriptive',
                            marks: 16,
                            co: q.co || ('CO' + (i + 1)),
                            unit: q.unit || ('Unit ' + (i + 1)),
                            k_level: 'K4',
                            parent_id: q.id,
                            or_group: 'b',
                            sub_number: null,
                            sort_order: 1,
                            children: []
                        }
                    ];
                }
            }

            // Part C: 1 question (8) with OR children 8(a) and 8(b)
            let partC = this.state.questions.find(q => q.part === 'C' && !q.parent_id);
            if (!partC) {
                const parentIdC = 'q_' + Date.now() + '_c';
                partC = {
                    id: parentIdC,
                    part: 'C',
                    question_number: 8,
                    question_text: '',
                    question_type: 'descriptive',
                    marks: 8,
                    co: 'CO3',
                    unit: 'Unit 3',
                    k_level: 'K3',
                    image_path: null,
                    image_alignment: 'center',
                    image_size: 'medium',
                    image_width: null,
                    image_height: null,
                    parent_id: null,
                    or_group: null,
                    sub_number: null,
                    sort_order: 8,
                    mcq_options: null,
                    children: []
                };
                this.state.questions.push(partC);
            }
            partC.question_number = 8;
            partC.marks = 8;
            const hasOrCA = partC.children && partC.children.some(c => c.or_group === 'a');
            const hasOrCB = partC.children && partC.children.some(c => c.or_group === 'b');
            if (!hasOrCA || !hasOrCB) {
                const textA = (partC.children && partC.children.find(c => c.or_group === 'a')?.question_text) || partC.question_text || '';
                const textB = (partC.children && partC.children.find(c => c.or_group === 'b')?.question_text) || '';
                partC.children = [
                    {
                        id: partC.id + '_a',
                        part: 'C',
                        question_number: 8,
                        question_text: textA,
                        question_type: 'descriptive',
                        marks: 8,
                        co: partC.co || 'CO3',
                        unit: partC.unit || 'Unit 3',
                        k_level: 'K3',
                        parent_id: partC.id,
                        or_group: 'a',
                        sub_number: null,
                        sort_order: 0,
                        children: []
                    },
                    {
                        id: partC.id + '_b',
                        part: 'C',
                        question_number: 8,
                        question_text: textB,
                        question_type: 'descriptive',
                        marks: 8,
                        co: partC.co || 'CO3',
                        unit: partC.unit || 'Unit 3',
                        k_level: 'K4',
                        parent_id: partC.id,
                        or_group: 'b',
                        sub_number: null,
                        sort_order: 1,
                        children: []
                    }
                ];
            }
        } else if (reg === '25') {
            // Part B: 3 direct questions 6, 7, 8 (3 marks each, no OR)
            const partBQs = this.state.questions.filter(q => q.part === 'B' && !q.parent_id);
            for (let i = 0; i < 3; i++) {
                const qNum = 6 + i;
                let q = partBQs[i];
                if (!q) {
                    q = {
                        id: 'q25_' + Date.now() + '_b' + i,
                        part: 'B',
                        question_number: qNum,
                        question_text: '',
                        question_type: 'descriptive',
                        marks: 3,
                        co: 'CO' + (i + 1),
                        unit: 'Unit ' + (i + 1),
                        k_level: 'K2',
                        image_path: null,
                        image_alignment: 'center',
                        image_size: 'medium',
                        image_width: null,
                        image_height: null,
                        parent_id: null,
                        or_group: null,
                        sub_number: null,
                        sort_order: qNum,
                        mcq_options: null,
                        children: []
                    };
                    this.state.questions.push(q);
                }
                q.question_number = qNum;
                q.marks = 3;
                q.children = [];
            }
            // Part C: 3 questions 9, 10, 11 with OR
            const partCQs = this.state.questions.filter(q => q.part === 'C' && !q.parent_id);
            for (let i = 0; i < 3; i++) {
                const qNum = 9 + i;
                let q = partCQs[i];
                if (!q) {
                    const parentId = 'q25_' + Date.now() + '_c' + i;
                    q = {
                        id: parentId,
                        part: 'C',
                        question_number: qNum,
                        question_text: '',
                        question_type: 'descriptive',
                        marks: 12,
                        co: 'CO' + (i + 2),
                        unit: 'Unit ' + (i + 2),
                        k_level: 'K4',
                        image_path: null,
                        image_alignment: 'center',
                        image_size: 'medium',
                        image_width: null,
                        image_height: null,
                        parent_id: null,
                        or_group: null,
                        sub_number: null,
                        sort_order: qNum,
                        mcq_options: null,
                        children: []
                    };
                    this.state.questions.push(q);
                }
                q.question_number = qNum;
                q.marks = 12;
                const hasOrA = q.children && q.children.some(c => c.or_group === 'a');
                const hasOrB = q.children && q.children.some(c => c.or_group === 'b');
                if (!hasOrA || !hasOrB) {
                    const textA = (q.children && q.children.find(c => c.or_group === 'a')?.question_text) || q.question_text || '';
                    const textB = (q.children && q.children.find(c => c.or_group === 'b')?.question_text) || '';
                    q.children = [
                        {
                            id: q.id + '_a',
                            part: 'C',
                            question_number: qNum,
                            question_text: textA,
                            question_type: 'descriptive',
                            marks: 12,
                            co: q.co || ('CO' + (i + 2)),
                            unit: q.unit || ('Unit ' + (i + 2)),
                            k_level: 'K4',
                            parent_id: q.id,
                            or_group: 'a',
                            sub_number: null,
                            sort_order: 0,
                            children: []
                        },
                        {
                            id: q.id + '_b',
                            part: 'C',
                            question_number: qNum,
                            question_text: textB,
                            question_type: 'descriptive',
                            marks: 12,
                            co: q.co || ('CO' + (i + 2)),
                            unit: q.unit || ('Unit ' + (i + 2)),
                            k_level: 'K5',
                            parent_id: q.id,
                            or_group: 'b',
                            sub_number: null,
                            sort_order: 1,
                            children: []
                        }
                    ];
                }
            }
        } else {
            // Dynamic structure enforcement for custom regulations
            const template = this.getTemplate(reg);
            if (template && template.sections) {
                let qCounter = 1;
                template.sections.forEach(section => {
                    const secQs = this.state.questions.filter(q => q.part === section.part && !q.parent_id);
                    for (let i = 0; i < section.questionsCount; i++) {
                        const qNum = qCounter++;
                        let q = secQs[i];
                        if (!q) {
                            const parentId = 'qc_' + Date.now() + '_' + section.part + '_' + i;
                            q = {
                                id: parentId,
                                part: section.part,
                                question_number: qNum,
                                question_text: '',
                                question_type: (section.questionTypes && section.questionTypes.includes('mcq') && !section.questionTypes.includes('descriptive')) ? 'mcq' : 'descriptive',
                                marks: section.marksEach,
                                co: 'CO' + Math.min(i + 1, template.maxCO || 5),
                                unit: 'Unit ' + Math.min(i + 1, template.maxUnits || 5),
                                k_level: section.marksEach <= 2 ? 'K1' : 'K2',
                                image_path: null,
                                image_alignment: 'center',
                                image_size: 'medium',
                                image_width: null,
                                image_height: null,
                                parent_id: null,
                                or_group: null,
                                sub_number: null,
                                sort_order: qNum,
                                mcq_options: null,
                                children: []
                            };
                            this.state.questions.push(q);
                        }
                        q.question_number = qNum;
                        q.marks = section.marksEach;

                        if (section.allowOR) {
                            const hasOrA = q.children && q.children.some(c => c.or_group === 'a');
                            const hasOrB = q.children && q.children.some(c => c.or_group === 'b');
                            if (!hasOrA || !hasOrB) {
                                const textA = (q.children && q.children.find(c => c.or_group === 'a')?.question_text) || q.question_text || '';
                                const textB = (q.children && q.children.find(c => c.or_group === 'b')?.question_text) || '';
                                q.children = [
                                    {
                                        id: q.id + '_a',
                                        part: section.part,
                                        question_number: qNum,
                                        question_text: textA,
                                        question_type: 'descriptive',
                                        marks: section.marksEach,
                                        co: q.co || 'CO1',
                                        unit: q.unit || 'Unit 1',
                                        k_level: 'K3',
                                        parent_id: q.id,
                                        or_group: 'a',
                                        sub_number: null,
                                        sort_order: 0,
                                        children: []
                                    },
                                    {
                                        id: q.id + '_b',
                                        part: section.part,
                                        question_number: qNum,
                                        question_text: textB,
                                        question_type: 'descriptive',
                                        marks: section.marksEach,
                                        co: q.co || 'CO1',
                                        unit: q.unit || 'Unit 1',
                                        k_level: 'K4',
                                        parent_id: q.id,
                                        or_group: 'b',
                                        sub_number: null,
                                        sort_order: 1,
                                        children: []
                                    }
                                ];
                            }
                        }
                    }
                });
            }
        }
    },

    // =============================================
    // Settings & Regulation Manager Controller
    // =============================================
    renderSettingsPage() {
        const container = document.getElementById('settingsRegulationsList');
        if (!container) return;

        const regs = this.getAllRegulations();
        let html = '';

        regs.forEach(r => {
            const isBuiltIn = !!r.isBuiltIn;
            const badgeClass = isBuiltIn ? 'reg-badge-builtin' : 'reg-badge-custom';
            const badgeLabel = isBuiltIn ? 'Built-in Template' : 'Custom Staff Template';
            const sectionsSummary = r.sections
                ? r.sections.map(s => `Part ${s.part} (${s.questionsCount} × ${s.marksEach}m${s.allowOR ? ' OR' : ''}${s.questionTypes && s.questionTypes.includes('mcq') ? ' MCQ' : ''})`).join('  •  ')
                : (r.description || '');

            html += `
                <div class="reg-card-item">
                    <div>
                        <div class="reg-info-title">
                            ${r.name || r.code + ' Regulation'}
                            <span class="${badgeClass}">${badgeLabel}</span>
                            <span style="font-size:12px; color:var(--text-muted);">[Code: ${r.code}]</span>
                        </div>
                        <div class="reg-info-summary">
                            <span><strong>Total Marks:</strong> ${r.totalMarks} Marks</span>
                            <span><strong>Structure:</strong> ${sectionsSummary}</span>
                        </div>
                    </div>
                    <div class="reg-actions-group">
                        <button class="btn btn-outline btn-sm" onclick="App.setRegulation('${r.code}'); App.navigate('create');" title="Create Paper with this regulation">
                            Use Template
                        </button>
                        ${!isBuiltIn ? `
                            <button class="btn btn-secondary btn-sm" onclick="App.openRegulationModal('${r.code}')" title="Edit Regulation">
                                Edit
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="App.deleteCustomRegulation('${r.code}')" title="Delete Regulation">
                                Delete
                            </button>
                        ` : ''}
                    </div>
                </div>`;
        });

        container.innerHTML = html;
    },

    openRegulationModal(code = null) {
        const modal = document.getElementById('regulationModal');
        if (!modal) return;

        const titleEl = document.getElementById('regModalTitle');
        const nameInput = document.getElementById('modalRegName');
        const codeInput = document.getElementById('modalRegCode');
        const totalMarksInput = document.getElementById('modalRegTotalMarks');
        const maxUnitsInput = document.getElementById('modalRegMaxUnits');
        const maxCOInput = document.getElementById('modalRegMaxCO');
        const container = document.getElementById('modalSectionsContainer');

        container.innerHTML = '';

        if (code) {
            // Edit existing custom regulation
            const reg = Storage.getCustomRegulation(code);
            if (reg) {
                if (titleEl) titleEl.textContent = `🛠️ Edit Regulation (${reg.code})`;
                nameInput.value = reg.name || '';
                codeInput.value = reg.code || '';
                codeInput.disabled = true; // Lock code during edit
                totalMarksInput.value = reg.totalMarks || 50;
                maxUnitsInput.value = reg.maxUnits || 5;
                maxCOInput.value = reg.maxCO || 5;

                (reg.sections || []).forEach(sec => this.addSectionRow(sec));
            }
        } else {
            // New regulation default setup
            if (titleEl) titleEl.textContent = '🛠️ Create New Regulation Template';
            nameInput.value = '';
            codeInput.value = '';
            codeInput.disabled = false;
            totalMarksInput.value = 50;
            maxUnitsInput.value = 5;
            maxCOInput.value = 5;

            // Default 3 parts: Part A, Part B, Part C
            this.addSectionRow({ part: 'A', title: 'PART – A', questionsCount: 5, marksEach: 2, allowOR: false, allowSubQuestions: false, allowMCQ: false, description: 'Answer ALL Questions' });
            this.addSectionRow({ part: 'B', title: 'PART – B', questionsCount: 2, marksEach: 16, allowOR: true, allowSubQuestions: true, allowMCQ: false, description: 'Answer ALL Questions (Internal Choice)' });
            this.addSectionRow({ part: 'C', title: 'PART – C', questionsCount: 1, marksEach: 8, allowOR: true, allowSubQuestions: true, allowMCQ: false, description: 'Answer ALL Questions (Internal Choice)' });
        }

        this.recalcModalMarks();
        modal.classList.add('active');
    },

    closeRegulationModal() {
        const modal = document.getElementById('regulationModal');
        if (modal) modal.classList.remove('active');
    },

    addSectionRow(secData = null) {
        const container = document.getElementById('modalSectionsContainer');
        if (!container) return;

        const currentCount = container.querySelectorAll('.sec-row-card').length;
        const defaultLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        const partLetter = secData?.part || defaultLetters[Math.min(currentCount, defaultLetters.length - 1)];

        const sec = {
            part: partLetter,
            title: secData?.title || `PART – ${partLetter}`,
            questionsCount: parseInt(secData?.questionsCount) || (currentCount === 0 ? 5 : 2),
            marksEach: parseInt(secData?.marksEach) || (currentCount === 0 ? 2 : 16),
            allowOR: secData ? !!secData.allowOR : (currentCount > 0),
            allowSubQuestions: secData ? !!secData.allowSubQuestions : (currentCount > 0),
            allowMCQ: secData?.allowMCQ || (secData?.questionTypes && secData.questionTypes.includes('mcq')) || false,
            description: secData?.description || (secData?.allowOR ? 'Answer ALL Questions (Internal Choice)' : 'Answer ALL Questions')
        };

        // Generate options 1 to 30 for question count dropdown
        const countOptions = [];
        for (let i = 1; i <= 30; i++) {
            countOptions.push(`<option value="${i}" ${sec.questionsCount === i ? 'selected' : ''}>${i} ${i === 1 ? 'Question' : 'Questions'}</option>`);
        }
        [35, 40, 50].forEach(n => {
            countOptions.push(`<option value="${n}" ${sec.questionsCount === n ? 'selected' : ''}>${n} Questions</option>`);
        });

        // Common marks options
        const marksList = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14, 15, 16, 20, 25, 30, 50];
        if (!marksList.includes(sec.marksEach)) marksList.push(sec.marksEach);
        marksList.sort((a, b) => a - b);
        const marksOptions = marksList.map(m =>
            `<option value="${m}" ${sec.marksEach === m ? 'selected' : ''}>${m} ${m === 1 ? 'Mark' : 'Marks'}</option>`
        ).join('');

        const card = document.createElement('div');
        card.className = 'sec-row-card';
        card.innerHTML = `
            <div class="sec-row-header">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <h5>📌 Part Section: <span class="sec-part-display">${sec.part}</span></h5>
                    <span class="sec-range-badge">Q1 – Q${sec.questionsCount}</span>
                    <span class="sec-subtotal-badge">(${sec.questionsCount * sec.marksEach} Marks)</span>
                </div>
                <button type="button" class="btn btn-sm btn-danger" onclick="App.removeSectionRow(this)" title="Remove Part">✕ Remove</button>
            </div>
            <div class="sec-grid-inputs">
                <div class="form-group">
                    <label class="form-label">Part</label>
                    <input class="form-input sec-part" value="${sec.part}" maxlength="4" oninput="this.value = this.value.toUpperCase(); this.closest('.sec-row-card').querySelector('.sec-part-display').textContent = this.value; App.recalcModalMarks();">
                </div>
                <div class="form-group">
                    <label class="form-label">Section Title</label>
                    <input class="form-input sec-title" value="${sec.title}">
                </div>
                <div class="form-group">
                    <label class="form-label">Total Questions</label>
                    <select class="form-select sec-count" onchange="App.recalcModalMarks()">
                        ${countOptions.join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Marks Each</label>
                    <select class="form-select sec-marks" onchange="App.recalcModalMarks()">
                        ${marksOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <input class="form-input sec-desc" value="${sec.description}">
                </div>
            </div>
            <div class="sec-toggles-row">
                <label class="checkbox-pill">
                    <input type="checkbox" class="sec-or" ${sec.allowOR ? 'checked' : ''}>
                    <span>Enable Internal Choice (a) OR (b)</span>
                </label>
                <label class="checkbox-pill">
                    <input type="checkbox" class="sec-sub" ${sec.allowSubQuestions ? 'checked' : ''}>
                    <span>Allow Sub-questions (i), (ii)</span>
                </label>
                <label class="checkbox-pill">
                    <input type="checkbox" class="sec-mcq" ${sec.allowMCQ ? 'checked' : ''}>
                    <span>Enable MCQ Option Fields</span>
                </label>
            </div>`;

        container.appendChild(card);
        this.recalcModalMarks();
    },

    removeSectionRow(btn) {
        const row = btn.closest('.sec-row-card');
        if (row) {
            row.remove();
            this.recalcModalMarks();
        }
    },

    recalcModalMarks() {
        const container = document.getElementById('modalSectionsContainer');
        const targetMarks = parseInt(document.getElementById('modalRegTotalMarks')?.value) || 50;
        const targetDisplay = document.getElementById('modalTargetMarksDisplay');
        const calcDisplay = document.getElementById('modalCalculatedMarks');
        const questionsDisplay = document.getElementById('modalCalculatedQuestions');
        const overallRangeDisplay = document.getElementById('modalOverallRange');
        if (targetDisplay) targetDisplay.textContent = targetMarks;

        let totalMarks = 0;
        let totalQuestions = 0;
        let currentStartQ = 1;

        if (container) {
            const cards = container.querySelectorAll('.sec-row-card');
            cards.forEach((card, idx) => {
                const count = parseInt(card.querySelector('.sec-count')?.value) || 0;
                const marks = parseInt(card.querySelector('.sec-marks')?.value) || 0;
                const part = (card.querySelector('.sec-part')?.value || 'A').trim().toUpperCase();

                const partMarks = count * marks;
                totalMarks += partMarks;
                totalQuestions += count;

                const startQ = currentStartQ;
                const endQ = count > 0 ? (currentStartQ + count - 1) : startQ;
                if (count > 0) {
                    currentStartQ += count;
                }

                // Update live range badge on this part card
                const rangeBadge = card.querySelector('.sec-range-badge');
                if (rangeBadge) {
                    if (count <= 0) {
                        rangeBadge.textContent = 'No questions';
                        rangeBadge.className = 'sec-range-badge empty';
                    } else if (count === 1) {
                        rangeBadge.textContent = `Q${startQ} (1 Q)`;
                        rangeBadge.className = 'sec-range-badge';
                    } else {
                        rangeBadge.textContent = `Q${startQ} – Q${endQ} (${count} Qs)`;
                        rangeBadge.className = 'sec-range-badge';
                    }
                }

                // Update subtotal marks badge on this part card
                const subtotalBadge = card.querySelector('.sec-subtotal-badge');
                if (subtotalBadge) {
                    subtotalBadge.textContent = `(${count} × ${marks} = ${partMarks} Marks)`;
                }
            });
        }

        if (questionsDisplay) {
            questionsDisplay.textContent = totalQuestions;
        }
        if (overallRangeDisplay) {
            overallRangeDisplay.textContent = totalQuestions > 0 ? `(Q1 to Q${totalQuestions})` : `(0 Questions)`;
        }
        if (calcDisplay) {
            calcDisplay.textContent = totalMarks;
            calcDisplay.style.color = (totalMarks === targetMarks) ? 'var(--success)' : 'var(--danger)';
        }
    },

    onModalNameChange() {
        const nameInput = document.getElementById('modalRegName');
        const codeInput = document.getElementById('modalRegCode');
        if (nameInput && codeInput && !codeInput.disabled && !codeInput.value) {
            const match = nameInput.value.match(/\d+/);
            if (match) {
                codeInput.value = match[0];
            }
        }
    },

    saveRegulationFromModal() {
        const name = (document.getElementById('modalRegName')?.value || '').trim();
        let code = (document.getElementById('modalRegCode')?.value || '').trim().toUpperCase();
        const totalMarks = parseInt(document.getElementById('modalRegTotalMarks')?.value) || 50;
        const maxUnits = parseInt(document.getElementById('modalRegMaxUnits')?.value) || 5;
        const maxCO = parseInt(document.getElementById('modalRegMaxCO')?.value) || 5;

        if (!name) {
            App.showToast('Please enter a Regulation Name', 'error');
            return;
        }
        if (!code) {
            App.showToast('Please enter a Regulation Code (e.g. 26)', 'error');
            return;
        }

        const container = document.getElementById('modalSectionsContainer');
        const rows = container?.querySelectorAll('.sec-row-card') || [];
        if (rows.length === 0) {
            App.showToast('Please add at least one Part Section', 'error');
            return;
        }

        const sections = [];
        let calcMarks = 0;
        rows.forEach(card => {
            const part = (card.querySelector('.sec-part')?.value || 'A').trim().toUpperCase();
            const title = (card.querySelector('.sec-title')?.value || `PART – ${part}`).trim();
            const count = parseInt(card.querySelector('.sec-count')?.value) || 1;
            const marksEach = parseInt(card.querySelector('.sec-marks')?.value) || 1;
            const desc = (card.querySelector('.sec-desc')?.value || 'Answer ALL Questions').trim();
            const allowOR = !!card.querySelector('.sec-or')?.checked;
            const allowSub = !!card.querySelector('.sec-sub')?.checked;
            const allowMCQ = !!card.querySelector('.sec-mcq')?.checked;

            const partTotal = count * marksEach;
            calcMarks += partTotal;

            sections.push({
                part,
                title,
                subtitle: `(${count} × ${marksEach} = ${partTotal} Marks)`,
                questionsCount: count,
                marksEach,
                totalMarks: partTotal,
                allowOR,
                allowSubQuestions: allowSub,
                allowMCQ,
                questionTypes: allowMCQ ? ['mcq', 'descriptive'] : ['descriptive'],
                description: desc
            });
        });

        const regData = {
            code,
            name,
            totalMarks,
            maxUnits,
            maxCO,
            sections
        };

        Storage.saveCustomRegulation(regData);
        this.closeRegulationModal();
        this.updateRegulationToggles();
        this.renderSettingsPage();
        App.showToast(`Regulation ${name} (${code}) saved successfully!`, 'success');
    },

    deleteCustomRegulation(code) {
        if (!confirm(`Delete custom regulation ${code}?`)) return;
        Storage.deleteCustomRegulation(code);
        if (this.state.regulation === code) {
            this.setRegulation('21', true);
        }
        this.updateRegulationToggles();
        this.renderSettingsPage();
        App.showToast(`Regulation ${code} deleted`, 'warning');
    },

    onQuestionChange() {
        this.validateAndDisplay();
        QuestionBuilder.updateAllValidation();
        this.updatePreview();
        this.triggerAutoSave();
    },

    onFieldChange() {
        this.syncFieldsToState();
        this.updateDetailsValidation();
        this.validateAndDisplay();
        this.updatePreview();
        this.triggerAutoSave();
    },

    updateDetailsValidation() {
        const badge = document.getElementById('detailsValidation');
        if (!badge) return;
        const valid = this.state.course_code && this.state.course_code.trim() &&
                      this.state.course_name && this.state.course_name.trim() &&
                      this.state.programme;
        if (valid) {
            badge.className = 'validation-badge valid';
            badge.innerHTML = '✓ Details Complete';
        } else {
            badge.className = 'validation-badge invalid';
            badge.innerHTML = 'Fill details below';
        }
    },

    updatePreview() {
        const paperData = this.getCurrentPaperData();
        Preview.render(paperData);
    },

    togglePreviewPanel() {
        const previewCol = document.getElementById('previewColumn');
        const splitLayout = document.querySelector('.create-split-layout');
        const fab = document.getElementById('previewFab');
        if (!previewCol) return;

        const isHidden = previewCol.classList.contains('collapsed');
        if (isHidden) {
            previewCol.classList.remove('collapsed');
            splitLayout?.classList.remove('preview-hidden');
            if (fab) fab.style.display = 'none';
            this.updatePreview();
        } else {
            previewCol.classList.add('collapsed');
            splitLayout?.classList.add('preview-hidden');
            if (fab && this.currentPage === 'create') fab.style.display = 'flex';
        }
    },

    updateFabVisibility() {
        const previewCol = document.getElementById('previewColumn');
        const fab = document.getElementById('previewFab');
        if (!fab) return;
        if (this.currentPage === 'create' && previewCol && previewCol.classList.contains('collapsed')) {
            fab.style.display = 'flex';
        } else {
            fab.style.display = 'none';
        }
    },

    validateAndDisplay() {
        const paperData = this.getCurrentPaperData();
        const validation = Validation.validate(paperData, this.state.regulation);
        Validation.renderValidationSummary(validation);
        this.updateDetailsValidation();
    },

    // =============================================
    // Paper Data
    // =============================================
    getCurrentPaperData() {
        // Sync form fields to state
        this.syncFieldsToState();

        return {
            id: this.state.id,
            regulation: this.state.regulation,
            exam_type: this.state.exam_type,
            degree: this.state.degree || (this.state.programme === 'Artificial Intelligence and Data Science' ? 'B.Tech' : 'B.E.'),
            programme: this.state.programme,
            course_code: this.state.course_code,
            course_name: this.state.course_name,
            year: this.state.year,
            semester: this.state.semester,
            exam_date: this.state.exam_date,
            duration: this.state.duration || '1 1/2 hrs',
            max_marks: this.state.max_marks,
            status: this.state.status,
            questions: this.state.questions,
            created_at: this.state.created_at,
            updated_at: this.state.updated_at
        };
    },

    syncFieldsToState() {
        const fields = {
            fieldExamType: 'exam_type',
            fieldDegree: 'degree',
            fieldProgramme: 'programme',
            fieldCourseCode: 'course_code',
            fieldCourseName: 'course_name',
            fieldYear: 'year',
            fieldSemester: 'semester',
            fieldDate: 'exam_date',
            fieldDuration: 'duration'
        };

        Object.entries(fields).forEach(([elId, stateKey]) => {
            const el = document.getElementById(elId);
            if (el) this.state[stateKey] = el.value;
        });

        // Force course_code to uppercase
        if (this.state.course_code) {
            this.state.course_code = this.state.course_code.toUpperCase();
        }
    },

    applyFieldValues() {
        const fields = {
            fieldExamType: this.state.exam_type,
            fieldDegree: this.state.degree,
            fieldProgramme: this.state.programme,
            fieldCourseCode: this.state.course_code,
            fieldCourseName: this.state.course_name,
            fieldYear: this.state.year,
            fieldSemester: this.state.semester,
            fieldDate: this.state.exam_date,
            fieldDuration: this.state.duration || '1 1/2 hrs'
        };

        Object.entries(fields).forEach(([elId, value]) => {
            const el = document.getElementById(elId);
            if (el && value !== undefined && value !== null) el.value = value;
        });
    },

    onProgrammeChange(prog) {
        this.state.programme = prog;
        // AIDS automatically sets to B.Tech, all others set to B.E.
        if (prog === 'Artificial Intelligence and Data Science') {
            this.state.degree = 'B.Tech';
        } else {
            this.state.degree = 'B.E.';
        }
        const degEl = document.getElementById('fieldDegree');
        if (degEl) degEl.value = this.state.degree;
        this.triggerAutoSave();
    },

    onDegreeChange(deg) {
        this.state.degree = deg;
        this.triggerAutoSave();
    },

    loadState(paperData) {
        Object.assign(this.state, paperData);
        if (!this.state.degree) {
            this.state.degree = this.state.programme === 'Artificial Intelligence and Data Science' ? 'B.Tech' : 'B.E.';
        }
        this.ensureRegulationStructure();
    },

    printPaper() {
        this.syncFieldsToState();
        this.ensureRegulationStructure();
        const paperData = this.getCurrentPaperData();
        Preview.print(paperData);
    },

    // =============================================
    // Save / Load
    // =============================================
    savePaper() {
        this.syncFieldsToState();
        const paperData = this.getCurrentPaperData();

        if (!paperData.id) {
            paperData.id = 'paper_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            this.state.id = paperData.id;
        }

        paperData.status = paperData.status === 'exported' ? 'exported' : 'completed';
        this.state.status = paperData.status;

        Storage.savePaper(paperData);
        Storage.saveCurrentPaper(paperData);

        this.showToast('Paper saved successfully!', 'success');
        this.updateDashboardStats();
    },

    createNewPaper() {
        // Fully reset all state to fresh defaults
        this.state.id = null;
        this.state.regulation = '21';
        this.state.exam_type = 'Internal Assessment-I';
        this.state.degree = 'B.Tech';
        this.state.programme = 'Artificial Intelligence and Data Science';
        this.state.course_code = '';
        this.state.course_name = '';
        this.state.year = '';
        this.state.semester = '';
        this.state.exam_date = '';
        this.state.duration = '1 1/2 hrs';
        this.state.max_marks = 50;
        this.state.status = 'draft';
        this.state.created_at = null;
        this.state.updated_at = null;

        this.initDefaultQuestions();
        this.ensureRegulationStructure();
        Storage.clearCurrentPaper();

        this.navigate('create');
    },

    loadPaper(id) {
        const paper = Storage.getPaper(id);
        if (!paper) {
            this.showToast('Paper not found!', 'error');
            return;
        }

        this.loadState(paper);
        Storage.saveCurrentPaper(paper);
        this.navigate('create');
    },

    // =============================================
    // Auto-save
    // =============================================
    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            if (this.state.questions.some(q => q.question_text && q.question_text.trim())) {
                this.syncFieldsToState();
                Storage.saveCurrentPaper(this.getCurrentPaperData());
                this.showAutoSaveIndicator();
            }
        }, this.autoSaveInterval);
    },

    triggerAutoSave() {
        // Debounced auto-save
        clearTimeout(this._debounceSave);
        this._debounceSave = setTimeout(() => {
            this.syncFieldsToState();
            Storage.saveCurrentPaper(this.getCurrentPaperData());
            this.showAutoSaveIndicator();
        }, 2000);
    },

    showAutoSaveIndicator() {
        const indicator = document.getElementById('autosaveIndicator');
        if (indicator) {
            indicator.style.display = 'flex';
            setTimeout(() => { indicator.style.display = 'none'; }, 3000);
        }
    },

    // =============================================
    // Dashboard
    // =============================================
    updateDashboardStats() {
        const papers = Storage.getAllPapers();
        const bank = Storage.getQuestionBank();

        const el = (id) => document.getElementById(id);
        if (el('statTotalPapers')) el('statTotalPapers').textContent = papers.length;
        if (el('statDrafts')) el('statDrafts').textContent = papers.filter(p => p.status === 'draft').length;
        if (el('statCompleted')) el('statCompleted').textContent = papers.filter(p => p.status === 'completed' || p.status === 'exported').length;
        if (el('statBankCount')) el('statBankCount').textContent = bank.length;
    },

    renderRecentPapers() {
        const container = document.getElementById('recentPapersList');
        if (!container) return;

        const papers = Storage.getAllPapers().slice(0, 5);

        if (papers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <h3>No papers yet</h3>
                    <p>Create your first question paper to get started!</p>
                </div>`;
            return;
        }

        container.innerHTML = papers.map(p => {
            const modified = p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '';
            const created = p.created_at ? new Date(p.created_at).toLocaleDateString() : '';
            return `
            <div class="recent-paper-card" onclick="App.loadPaper('${p.id}')">
                <div class="recent-paper-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div class="recent-paper-info">
                    <h4>${p.course_code || 'No Code'} — ${p.course_name || 'Untitled Paper'}</h4>
                    <p>${p.regulation} Regulation • ${p.exam_type || 'Assessment'} • Modified: ${modified}</p>
                </div>
                <div class="recent-paper-meta">
                    <span class="status-badge ${p.status}">${p.status}</span>
                </div>
            </div>`;
        }).join('');
    },

    // =============================================
    // Sidebar
    // =============================================
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    },

    closeSidebar() {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
    },

    // =============================================
    // Toast Notifications
    // =============================================
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span style="font-size:18px">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span style="flex:1; font-size:14px;">${message}</span>
            <button onclick="this.parentElement.remove()" style="background:none; border:none; font-size:18px; cursor:pointer; color:var(--text-muted);">×</button>`;

        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }
};

// =============================================
// Initialize on DOM ready
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
