/**
 * Question Builder
 * Interactive question card builder with OR/sub support
 * Grace College Question Paper Generator
 */
const QuestionBuilder = {
    editors: {},       // Quill editor instances
    sortables: {},     // SortableJS instances
    cropper: null,     // Cropper.js instance
    cropTargetId: null,

    /**
     * Initialize question sections from regulation template
     */
    init(regulation) {
        const template = (typeof App !== 'undefined' && App.getTemplate) ? App.getTemplate(regulation) : (regulation === '25' ? REGULATION_25 : REGULATION_21);
        const container = document.getElementById('questionSections');
        if (!container) return;

        // Cleanup existing editors
        this.cleanup();

        let html = '';
        template.sections.forEach(section => {
            html += this.renderSection(section, template);
        });
        container.innerHTML = html;

        // Initialize SortableJS for each section
        template.sections.forEach(section => {
            const el = document.getElementById(`questions-${section.part}`);
            if (el) {
                this.sortables[section.part] = new Sortable(el, {
                    handle: '.drag-handle',
                    animation: 200,
                    ghostClass: 'dragging',
                    onEnd: () => this.onReorder(section.part)
                });
            }
        });

        this.updateAllValidation();
    },

    /**
     * Render a section container
     */
    renderSection(section, template) {
        const questions = App.state.questions.filter(q => q.part === section.part && !q.parent_id);
        const startQ = questions.length > 0 ? questions[0].question_number : (template.questionNumbering?.[section.part]?.start || 1);
        const endQ = questions.length > 0 ? questions[questions.length - 1].question_number : (startQ + section.questionsCount - 1);
        const rangeText = questions.length <= 1 ? `Q${startQ}` : `Q${startQ} – Q${endQ}`;

        return `
            <div class="section-container" id="section-${section.part}">
                <div class="section-header">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <h3>${section.title} ${section.subtitle}</h3>
                        <span class="q-range-pill">${rangeText} • ${questions.length} Qs</span>
                    </div>
                    <span class="section-marks" id="sectionMarks-${section.part}">
                        0 / ${section.totalMarks} marks
                    </span>
                </div>
                <div class="section-body" id="questions-${section.part}">
                    ${questions.map(q => this.renderQuestionCard(q, section)).join('')}
                </div>
                <div class="section-footer">
                    <span class="validation-badge" id="sectionValid-${section.part}">
                        ${questions.length}/${section.questionsCount} questions (${rangeText})
                    </span>
                    <button type="button" class="btn btn-sm btn-outline" onclick="QuestionBuilder.addQuestion('${section.part}', ${section.allowOR})">
                        + Add Q in Part ${section.part}
                    </button>
                </div>
            </div>`;
    },

    /**
     * Render a single question card
     */
    renderQuestionCard(q, section) {
        const coK = `${q.co || 'CO1'}-${q.k_level || 'K1'}`;
        const hasOR = q.children && q.children.some(c => c.or_group);
        const hasSub = q.children && q.children.some(c => c.sub_number);
        const isMCQ = q.question_type === 'mcq';

        let cardHtml = `
            <div class="question-card" id="qcard-${q.id}" data-id="${q.id}">
                <div class="question-card-header">
                    <span class="q-number">${q.question_number}</span>
                    ${isMCQ ? '<span class="q-type-badge mcq">MCQ</span>' : ''}
                    <span class="co-k-display">${coK}</span>
                </div>
                <div class="question-card-body">`;

        if (hasOR) {
            // Render OR question format
            const orA = q.children.find(c => c.or_group === 'a');
            const orB = q.children.find(c => c.or_group === 'b');

            cardHtml += `<p style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">Internal Choice: Fill both options (a) and (b).</p>`;

            if (orA) cardHtml += this.renderORChild(orA, q, 'a');
            cardHtml += `<div class="or-separator"><span>OR</span></div>`;
            if (orB) cardHtml += this.renderORChild(orB, q, 'b');
        } else {
            // Regular question
            cardHtml += this.renderQuestionFields(q);
        }

        // Subquestion support
        if (hasSub) {
            const subs = q.children.filter(c => c.sub_number);
            cardHtml += `<div class="sub-questions" style="margin-top:12px;">
                <h4 style="font-size:13px; font-weight:600; margin-bottom:8px;">Sub-Questions</h4>`;
            subs.forEach(sub => {
                cardHtml += `<div class="sub-question" id="qcard-${sub.id}">
                    ${this.renderQuestionFields(sub, true)}
                </div>`;
            });
            cardHtml += `</div>`;
        }

        cardHtml += `</div></div>`;
        return cardHtml;
    },

    /**
     * Render OR child (a or b)
     */
    renderORChild(child, parent, group) {
        return `
            <div style="padding:12px; background:var(--bg); border-radius:var(--radius); margin-bottom:8px;" id="qcard-${child.id}">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <span class="q-number" style="min-width:32px; height:28px; padding:0 6px; font-size:12px; font-weight:700; border-radius:var(--radius-sm);">${parent.question_number}${group}</span>
                    <span class="co-k-display">${child.co || 'CO1'}-${child.k_level || 'K1'}</span>
                </div>
                ${this.renderQuestionFields(child)}
            </div>`;
    },

    /**
     * Render question fields (text, metadata, image)
     */
    renderQuestionFields(q, isSub = false) {
        const prefix = isSub ? `(${q.sub_number}) ` : '';
        const reg = App.state.regulation || '21';
        const template = (typeof App !== 'undefined' && App.getTemplate) ? App.getTemplate(reg) : (reg === '25' ? REGULATION_25 : REGULATION_21);
        const maxCO = template.maxCO || (reg === '25' ? 7 : 5);
        const maxUnit = template.maxUnits || (reg === '25' ? 7 : 5);

        // Regulation-specific CO options
        const coList = [];
        for (let i = 1; i <= maxCO; i++) coList.push('CO' + i);
        const coOptions = coList.map(co =>
            `<option value="${co}" ${q.co === co ? 'selected' : ''}>${co}</option>`
        ).join('');

        // Regulation-specific Unit options
        let unitOptions = '';
        for (let u = 1; u <= maxUnit; u++) {
            unitOptions += `<option value="Unit ${u}" ${q.unit === 'Unit ' + u ? 'selected' : ''}>Unit ${u}</option>`;
        }
        if (maxUnit > 5 || reg === '25') {
            // "Other" option: selected when unit doesn't match any standard option
            const isOther = q.unit && !q.unit.match(new RegExp(`^Unit [1-${maxUnit}]$`));
            unitOptions += `<option value="Other" ${isOther ? 'selected' : ''}>Other</option>`;
        }

        const kOptions = ['K1','K2','K3','K4','K5','K6'].map(k => {
            const labels = {K1:'Remember',K2:'Understand',K3:'Apply',K4:'Analyze',K5:'Evaluate',K6:'Create'};
            return `<option value="${k}" ${q.k_level === k ? 'selected' : ''}>${k} – ${labels[k]}</option>`;
        }).join('');

        // Question types: show type selector if section allows MCQ or descriptive
        const section = template.sections.find(s => s.part === q.part);
        const showTypeSelector = section && (section.allowMCQ || (reg === '25' && section.part === 'A'));

        // "Other" unit: show a number input for custom unit
        const isOtherUnit = (maxUnit > 5 || reg === '25') && q.unit && !q.unit.match(new RegExp(`^Unit [1-${maxUnit}]$`));
        const otherUnitNum = isOtherUnit ? q.unit.replace(/[^0-9]/g, '') : '';

        let html = `
            <div class="question-meta-row">
                ${showTypeSelector ? `
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select class="form-select" onchange="QuestionBuilder.updateField('${q.id}','question_type',this.value)">
                        <option value="mcq" ${q.question_type === 'mcq' ? 'selected' : ''}>MCQ</option>
                        <option value="descriptive" ${q.question_type === 'descriptive' || q.question_type === 'short' || q.question_type === 'long' ? 'selected' : ''}>Descriptive</option>
                    </select>
                </div>` : ''}
                <div class="form-group">
                    <label class="form-label">CO <span class="tooltip-trigger" data-tooltip="Course Outcome (CO1-CO${maxCO})">?</span></label>
                    <select class="form-select" id="co-select-${q.id}" onchange="QuestionBuilder.updateField('${q.id}','co',this.value)">
                        ${coOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Unit</label>
                    <select class="form-select" onchange="QuestionBuilder.onUnitChange('${q.id}', this.value)">
                        ${unitOptions}
                    </select>
                </div>
                ${isOtherUnit ? `
                <div class="form-group">
                    <label class="form-label">Unit No.</label>
                    <input class="form-input" type="number" min="1" max="20" value="${otherUnitNum}" placeholder="e.g. 8"
                        style="width:70px" onchange="QuestionBuilder.updateField('${q.id}','unit','Unit '+this.value)">
                </div>` : ''}
                <div class="form-group">
                    <label class="form-label">K-Level <span class="tooltip-trigger" data-tooltip="Bloom's Taxonomy Level">?</span></label>
                    <select class="form-select" onchange="QuestionBuilder.updateField('${q.id}','k_level',this.value)">
                        ${kOptions}
                    </select>
                </div>
            </div>
            <div class="question-text-area">
                <label class="form-label">${prefix}Question Text</label>
                <div id="editor-${q.id}" class="quill-editor-container"></div>
            </div>`;

        // MCQ options
        if (q.question_type === 'mcq') {
            const opts = q.mcq_options || [{label:'A',text:''},{label:'B',text:''},{label:'C',text:''},{label:'D',text:''}];
            html += `<div class="mcq-options" id="mcq-${q.id}">
                <label class="form-label" style="margin-bottom:8px">MCQ Options</label>
                ${opts.map((opt, i) => `
                    <div class="mcq-option-row">
                        <span class="mcq-label">${opt.label}</span>
                        <input class="form-input" type="text" value="${opt.text || ''}" placeholder="Option ${opt.label}..."
                            onchange="QuestionBuilder.updateMCQOption('${q.id}', ${i}, this.value)">
                    </div>`).join('')}
            </div>`;
        }

        // Image upload
        const hasImage = q.image_path && q.image_path.trim() !== '';
        const imgSizePreset = q.image_size || 'medium';
        const imgAlign = q.image_alignment || 'center';
        // Compute image max-width: use custom width if set, otherwise use preset
        let imgMaxWidth;
        if (imgSizePreset === 'custom' && q.image_width) {
            imgMaxWidth = q.image_width + 'px';
        } else {
            imgMaxWidth = imgSizePreset === 'small' ? '200px' : imgSizePreset === 'large' ? '500px' : '350px';
        }
        const currentWidthVal = q.image_width || (imgSizePreset === 'small' ? 200 : imgSizePreset === 'large' ? 500 : 350);
        html += `
            <div class="image-upload-area ${hasImage ? 'has-image' : ''}" id="imgArea-${q.id}">
                ${hasImage ? `
                    <div class="image-preview-container" style="text-align:${imgAlign};">
                        <div class="image-resizable-wrapper" style="display:inline-block; position:relative;">
                            <img src="${q.image_path}" alt="Question image" style="max-width:${imgMaxWidth}; height:auto; display:block;">
                            <div class="image-resize-handle" data-qid="${q.id}" title="Drag to resize">&#8600;</div>
                        </div>
                    </div>
                    <div class="image-controls">
                        <select class="form-select" style="width:auto; padding:4px 8px; font-size:12px;" onchange="QuestionBuilder.updateImageField('${q.id}','image_alignment',this.value)">
                            <option value="left" ${imgAlign==='left'?'selected':''}>⬅ Left</option>
                            <option value="center" ${imgAlign==='center'?'selected':''}>⬛ Center</option>
                            <option value="right" ${imgAlign==='right'?'selected':''}>➡ Right</option>
                        </select>
                        <button class="btn btn-sm btn-outline" onclick="QuestionBuilder.editImage('${q.id}')">✂️ Crop</button>
                        <button class="btn btn-sm btn-danger" onclick="QuestionBuilder.removeImage('${q.id}')">Remove</button>
                    </div>
                ` : `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">+ Add Image</p>
                `}
                <input type="file" id="imgInput-${q.id}" accept="image/png,image/jpeg,image/jpg,image/webp" style="display:none"
                    onchange="QuestionBuilder.handleImageUpload('${q.id}', event)">
            </div>`;

        return html;
    },

    /**
     * Initialize Quill editors for visible questions
     */
    initEditors() {
        const questions = this.getAllQuestionsFlatForEditors();
        questions.forEach(q => {
            const editorEl = document.getElementById(`editor-${q.id}`);
            if (editorEl && !this.editors[q.id]) {
                const quill = new Quill(editorEl, {
                    theme: 'snow',
                    placeholder: 'Enter question text...',
                    modules: {
                        toolbar: [
                            ['bold', 'italic', 'underline'],
                            [{ 'script': 'sub' }, { 'script': 'super' }],
                            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                            ['clean']
                        ]
                    }
                });

                // Set initial content
                if (q.question_text && q.question_text !== '<p><br></p>') {
                    quill.root.innerHTML = q.question_text;
                }

                // Listen for changes
                quill.on('text-change', () => {
                    const html = quill.root.innerHTML;
                    this.updateFieldSilent(q.id, 'question_text', html);
                    this.debouncedLiveUpdate();
                });

                this.editors[q.id] = quill;
            }
        });

        // Add click handlers for image upload areas
        questions.forEach(q => {
            const area = document.getElementById(`imgArea-${q.id}`);
            const input = document.getElementById(`imgInput-${q.id}`);
            if (area && input && !q.image_path) {
                area.onclick = () => input.click();
            }
        });

        // Initialize drag-to-resize handles for images
        this.initImageResizeHandles();
    },

    /**
     * Get all questions flat (including OR children) for editor init
     */
    getAllQuestionsFlatForEditors() {
        const flat = [];
        (App.state.questions || []).forEach(q => {
            flat.push(q);
            if (q.children) {
                q.children.forEach(c => flat.push(c));
            }
        });
        return flat;
    },

    /**
     * Initialize drag-to-resize handles on images
     */
    initImageResizeHandles() {
        document.querySelectorAll('.image-resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const qid = handle.getAttribute('data-qid');
                const wrapper = handle.closest('.image-resizable-wrapper');
                const img = wrapper ? wrapper.querySelector('img') : null;
                if (!img) return;

                const startX = e.clientX;
                const startWidth = img.getBoundingClientRect().width;

                const onMouseMove = (moveEvt) => {
                    const deltaX = moveEvt.clientX - startX;
                    const newWidth = Math.max(50, Math.min(800, Math.round(startWidth + deltaX)));
                    img.style.maxWidth = newWidth + 'px';
                    // Update slider/number if visible
                    const area = document.getElementById(`imgArea-${qid}`);
                    if (area) {
                        const slider = area.querySelector('.image-width-slider');
                        const numInput = area.querySelector('.image-custom-size-control input[type="number"]');
                        if (slider) slider.value = newWidth;
                        if (numInput) numInput.value = newWidth;
                    }
                };

                const onMouseUp = (upEvt) => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    // Save final width
                    const finalWidth = Math.max(50, Math.min(800, Math.round(img.getBoundingClientRect().width)));
                    const q = this.findQuestion(qid);
                    if (q) {
                        q.image_width = finalWidth;
                        q.image_size = 'custom';
                        this.refreshCards();
                        App.onQuestionChange();
                    }
                };

                document.body.style.cursor = 'nwse-resize';
                document.body.style.userSelect = 'none';
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    },

    /**
     * Update a question field and re-validate
     */
    updateField(id, field, value) {
        const q = this.findQuestion(id);
        if (q) {
            q[field] = value;
            App.onQuestionChange();

            // Update the CO-K display in the header
            if (field === 'co' || field === 'k_level') {
                this.refreshCards();
            }
            if (field === 'question_type') {
                this.refreshCards();
            }
            if (field === 'unit') {
                this.refreshCards();
            }
        }
    },

    /**
     * Update image-specific field and refresh the image display
     */
    updateImageField(id, field, value) {
        const q = this.findQuestion(id);
        if (q) {
            // Save previous size before overwriting
            const prevSize = q.image_size || 'medium';
            q[field] = value;
            // When switching to 'custom' size, initialize width from previous preset
            if (field === 'image_size' && value === 'custom' && !q.image_width) {
                q.image_width = prevSize === 'small' ? 200 : prevSize === 'large' ? 500 : 350;
            }
            // When switching away from 'custom', clear custom width
            if (field === 'image_size' && value !== 'custom') {
                q.image_width = null;
            }
            this.refreshCards();
            App.onQuestionChange();
        }
    },

    /**
     * Update custom image width (from slider or number input)
     */
    updateImageWidth(id, value) {
        const q = this.findQuestion(id);
        if (!q) return;
        const w = Math.max(50, Math.min(800, parseInt(value, 10) || 200));
        q.image_width = w;
        q.image_size = 'custom';
        // Update the slider and number input in-place without full re-render
        const area = document.getElementById(`imgArea-${id}`);
        if (area) {
            const slider = area.querySelector('.image-width-slider');
            const numInput = area.querySelector('.image-custom-size-control input[type="number"]');
            const wrapper = area.querySelector('.image-resizable-wrapper');
            if (slider && slider !== document.activeElement) slider.value = w;
            if (numInput && numInput !== document.activeElement) numInput.value = w;
            if (wrapper) {
                const img = wrapper.querySelector('img');
                if (img) img.style.maxWidth = w + 'px';
            }
        }
        App.triggerAutoSave();
        App.updatePreview();
    },

    /**
     * Handle unit dropdown change – auto-map CO for Reg 25
     */
    onUnitChange(id, value) {
        const q = this.findQuestion(id);
        if (!q) return;

        if (value === 'Other') {
            // Set a placeholder unit value; the number input will refine it
            q.unit = 'Other';
        } else {
            q.unit = value;
        }

        // Auto-map CO: Unit N → CON (for Regulations with matching units and COs)
        const template = App.getTemplate();
        const maxCO = template.maxCO || 5;
        if (value !== 'Other') {
            const unitNum = parseInt(value.replace(/[^0-9]/g, ''), 10);
            if (unitNum >= 1 && unitNum <= maxCO) {
                q.co = 'CO' + unitNum;
            }
        }

        App.onQuestionChange();
        this.refreshCards();
    },

    /**
     * Update without triggering re-render (for text changes)
     */
    updateFieldSilent(id, field, value) {
        const q = this.findQuestion(id);
        if (q) {
            q[field] = value;
            App.triggerAutoSave();
        }
    },

    /**
     * Find question by ID (including children)
     */
    findQuestion(id) {
        for (const q of App.state.questions) {
            if (q.id === id) return q;
            if (q.children) {
                const child = q.children.find(c => c.id === id);
                if (child) return child;
            }
        }
        return null;
    },

    /**
     * Find parent question by child ID
     */
    findParent(childId) {
        return App.state.questions.find(q =>
            q.children && q.children.some(c => c.id === childId)
        );
    },

    /**
     * Add a new question to a section
     */
    addQuestion(part, withOR = false) {
        const template = App.getTemplate();
        const section = template.sections.find(s => s.part === part);
        if (!section) return;

        const sectionQs = App.state.questions.filter(q => q.part === part && !q.parent_id);
        const startNum = (template.questionNumbering && template.questionNumbering[part]) ? template.questionNumbering[part].start : (sectionQs.length + 1);
        const nextNum = startNum + sectionQs.length;
        const id = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const isMCQ = section.allowMCQ || (part === 'A' && App.state.regulation === '25');

        const newQ = {
            id,
            part,
            question_number: nextNum,
            question_text: '',
            question_type: isMCQ ? 'mcq' : (section.marksEach <= 2 ? 'short' : 'long'),
            marks: section.marksEach,
            co: 'CO1',
            unit: 'Unit 1',
            k_level: 'K1',
            image_path: null,
            image_alignment: 'center',
            image_size: 'medium',
            image_width: null,
            image_height: null,
            parent_id: null,
            or_group: null,
            sub_number: null,
            sort_order: nextNum,
            mcq_options: isMCQ ? [{label:'A',text:''},{label:'B',text:''},{label:'C',text:''},{label:'D',text:''}] : null,
            children: []
        };

        if (withOR) {
            newQ.children = [
                {
                    id: id + '_a', part, question_number: nextNum,
                    question_text: '', question_type: 'long', marks: section.marksEach,
                    co: 'CO1', unit: 'Unit 1', k_level: 'K3',
                    parent_id: id, or_group: 'a', sub_number: null, sort_order: 0, children: []
                },
                {
                    id: id + '_b', part, question_number: nextNum,
                    question_text: '', question_type: 'long', marks: section.marksEach,
                    co: 'CO1', unit: 'Unit 1', k_level: 'K4',
                    parent_id: id, or_group: 'b', sub_number: null, sort_order: 1, children: []
                }
            ];
        }

        App.state.questions.push(newQ);
        this.renumberQuestions();
        this.refreshCards();
        App.onQuestionChange();
    },

    /**
     * Convert a regular question to OR format
     */
    convertToOR(id) {
        const q = this.findQuestion(id);
        if (!q) return;

        q.children = [
            {
                id: id + '_a', part: q.part, question_number: q.question_number,
                question_text: q.question_text || '', question_type: q.question_type, marks: q.marks,
                co: q.co, unit: q.unit, k_level: q.k_level,
                parent_id: id, or_group: 'a', sub_number: null, sort_order: 0, children: []
            },
            {
                id: id + '_b', part: q.part, question_number: q.question_number,
                question_text: '', question_type: q.question_type, marks: q.marks,
                co: q.co, unit: q.unit, k_level: q.k_level,
                parent_id: id, or_group: 'b', sub_number: null, sort_order: 1, children: []
            }
        ];

        this.refreshCards();
        App.onQuestionChange();
    },

    /**
     * Add a sub-question to a parent
     */
    addSubQuestion(parentId) {
        const parent = this.findQuestion(parentId);
        if (!parent) return;

        const subLabels = ['i', 'ii', 'iii', 'iv', 'v', 'vi'];
        const existingSubs = (parent.children || []).filter(c => c.sub_number);
        const nextSub = subLabels[existingSubs.length] || 'sub' + (existingSubs.length + 1);
        const subId = parentId + '_sub_' + nextSub;

        if (!parent.children) parent.children = [];
        parent.children.push({
            id: subId, part: parent.part, question_number: parent.question_number,
            question_text: '', question_type: parent.question_type,
            marks: Math.floor(parent.marks / 2),
            co: parent.co, unit: parent.unit, k_level: parent.k_level,
            parent_id: parentId, or_group: null, sub_number: nextSub, sort_order: existingSubs.length, children: []
        });

        this.refreshCards();
        App.onQuestionChange();
    },

    /**
     * Delete a question
     */
    deleteQuestion(id) {
        const idx = App.state.questions.findIndex(q => q.id === id);
        if (idx >= 0) {
            App.state.questions.splice(idx, 1);
            this.renumberQuestions();
            this.refreshCards();
            App.onQuestionChange();
            return;
        }
        // Check children
        const parent = this.findParent(id);
        if (parent) {
            parent.children = parent.children.filter(c => c.id !== id);
            this.refreshCards();
            App.onQuestionChange();
        }
    },

    /**
     * Duplicate a question
     */
    duplicateQuestion(id) {
        const q = this.findQuestion(id);
        if (!q || q.parent_id) return;

        const newQ = JSON.parse(JSON.stringify(q));
        const newId = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        newQ.id = newId;
        if (newQ.children) {
            newQ.children.forEach((c, i) => {
                c.id = newId + '_' + (c.or_group || 'sub' + i);
                c.parent_id = newId;
            });
        }

        const idx = App.state.questions.findIndex(oq => oq.id === id);
        App.state.questions.splice(idx + 1, 0, newQ);

        this.renumberQuestions();
        this.refreshCards();
        App.onQuestionChange();
        App.showToast('Question duplicated', 'success');
    },

    /**
     * Save question to bank
     */
    saveToBank(id) {
        const q = this.findQuestion(id);
        if (!q) return;

        Storage.addToBank({
            regulation: App.state.regulation,
            course_code: App.state.course_code,
            course_name: App.state.course_name,
            question_text: q.question_text,
            question_type: q.question_type,
            marks: q.marks,
            co: q.co,
            unit: q.unit,
            k_level: q.k_level,
            image_path: q.image_path,
            mcq_options: q.mcq_options
        });

        App.showToast('Saved to Question Bank!', 'success');
    },

    /**
     * Renumber all questions based on regulation template
     */
    renumberQuestions() {
        const template = App.getTemplate();
        let currentQ = 1;

        template.sections.forEach(section => {
            const sectionQs = App.state.questions.filter(q => q.part === section.part && !q.parent_id);
            sectionQs.forEach((q, idx) => {
                q.question_number = currentQ++;
                q.sort_order = q.question_number;
                // Update children
                if (q.children) {
                    q.children.forEach(c => { c.question_number = q.question_number; });
                }
            });
        });
    },

    /**
     * Handle drag/drop reorder
     */
    onReorder(part) {
        const container = document.getElementById(`questions-${part}`);
        if (!container) return;

        const cardIds = Array.from(container.children).map(el => el.dataset.id);
        const partQuestions = [];

        cardIds.forEach(id => {
            const q = App.state.questions.find(q => q.id === id);
            if (q) partQuestions.push(q);
        });

        // Remove all questions of this part, then re-add in new order
        App.state.questions = App.state.questions.filter(q => q.part !== part || q.parent_id);
        App.state.questions.push(...partQuestions);

        this.renumberQuestions();
        this.refreshCards();
        App.onQuestionChange();
    },

    /**
     * Handle image upload
     */
    handleImageUpload(id, event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const q = this.findQuestion(id);
            if (q) {
                q.image_path = e.target.result; // base64 data URL
                this.refreshCards();
                App.onQuestionChange();
            }
        };
        reader.readAsDataURL(file);
        event.stopPropagation();
    },

    /**
     * Edit image with cropper
     */
    editImage(id) {
        const q = this.findQuestion(id);
        if (!q || !q.image_path) return;

        this.cropTargetId = id;
        const modal = document.getElementById('cropperModal');
        const img = document.getElementById('cropperImage');
        img.src = q.image_path;

        modal.classList.add('active');

        setTimeout(() => {
            if (this.cropper) this.cropper.destroy();
            this.cropper = new Cropper(img, {
                aspectRatio: NaN,
                viewMode: 1,
                responsive: true,
                autoCropArea: 1
            });
        }, 300);
    },

    closeCropper() {
        const modal = document.getElementById('cropperModal');
        modal.classList.remove('active');
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
    },

    rotateCrop(degrees) {
        if (this.cropper) this.cropper.rotate(degrees);
    },

    applyCrop() {
        if (!this.cropper || !this.cropTargetId) return;

        const canvas = this.cropper.getCroppedCanvas({ maxWidth: 800, maxHeight: 800 });
        const dataUrl = canvas.toDataURL('image/png');
        const q = this.findQuestion(this.cropTargetId);
        if (q) {
            q.image_path = dataUrl;
            this.refreshCards();
            App.onQuestionChange();
        }
        this.closeCropper();
    },

    /**
     * Remove image from question
     */
    removeImage(id) {
        const q = this.findQuestion(id);
        if (q) {
            q.image_path = null;
            q.image_alignment = 'center';
            q.image_size = 'medium';
            this.refreshCards();
            App.onQuestionChange();
        }
    },

    /**
     * Update MCQ option
     */
    updateMCQOption(id, index, value) {
        const q = this.findQuestion(id);
        if (q && q.mcq_options && q.mcq_options[index]) {
            q.mcq_options[index].text = value;
            this.debouncedLiveUpdate();
            App.triggerAutoSave();
        }
    },

    /**
     * Debounced validation & preview update for smooth typing
     */
    debouncedLiveUpdate() {
        clearTimeout(this._liveTimer);
        this._liveTimer = setTimeout(() => {
            App.validateAndDisplay();
            this.updateAllValidation();
            App.updatePreview();
        }, 250);
    },

    /**
     * Refresh all question cards (full re-render)
     */
    refreshCards() {
        // Save editor content before re-render
        Object.keys(this.editors).forEach(id => {
            const q = this.findQuestion(id);
            if (q && this.editors[id]) {
                q.question_text = this.editors[id].root.innerHTML;
            }
        });

        this.cleanup();
        this.init(App.state.regulation);
        // Re-init editors after render
        setTimeout(() => {
            this.initEditors();
            App.updatePreview();
        }, 100);
    },

    /**
     * Update validation displays
     */
    updateAllValidation() {
        const template = App.getTemplate();
        template.sections.forEach(section => {
            const sectionQs = App.state.questions.filter(q => q.part === section.part && !q.parent_id);
            const status = Validation.getSectionStatus(App.state.questions, section);

            const marksEl = document.getElementById(`sectionMarks-${section.part}`);
            if (marksEl) {
                marksEl.textContent = `${status.currentMarks} / ${section.totalMarks} marks`;
            }

            const validEl = document.getElementById(`sectionValid-${section.part}`);
            if (validEl) {
                if (status.isValid) {
                    validEl.className = 'validation-badge valid';
                    validEl.textContent = `✓ ${status.currentCount}/${section.questionsCount} questions`;
                } else {
                    validEl.className = 'validation-badge' + (status.marksOk && status.countOk ? ' warning' : ' invalid');
                    validEl.textContent = `${status.currentCount}/${section.questionsCount} questions`;
                }
            }
        });
    },

    /**
     * Scroll to a specific question
     */
    scrollToQuestion(id) {
        const el = document.getElementById(`qcard-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.animation = 'none';
            setTimeout(() => {
                el.style.boxShadow = '0 0 0 3px var(--error), var(--shadow-lg)';
                setTimeout(() => { el.style.boxShadow = ''; }, 2000);
            }, 300);
        }
    },

    /**
     * Cleanup editors and sortables
     */
    cleanup() {
        Object.values(this.editors).forEach(editor => {
            // Quill doesn't have a destroy method, but we clear refs
        });
        this.editors = {};
        Object.values(this.sortables).forEach(s => s.destroy && s.destroy());
        this.sortables = {};
    }
};
