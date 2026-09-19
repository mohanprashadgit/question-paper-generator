/**
 * Grace College Question Paper Generator
 * Regulation 21 Template Definition
 */
const REGULATION_21 = {
    name: '21 Regulation',
    code: '21',
    totalMarks: 50,
    sections: [
        {
            part: 'A',
            title: 'PART – A',
            subtitle: '(5 × 2 = 10 Marks)',
            questionsCount: 5,
            marksEach: 2,
            totalMarks: 10,
            allowOR: false,
            allowSubQuestions: false,
            fixedMarks: true,
            questionTypes: ['descriptive'],
            description: 'Answer ALL Questions'
        },
        {
            part: 'B',
            title: 'PART – B',
            subtitle: '(2 × 16 = 32 Marks)',
            questionsCount: 2,
            marksEach: 16,
            totalMarks: 32,
            allowOR: true,
            allowSubQuestions: true,
            fixedMarks: true,
            questionTypes: ['descriptive'],
            description: 'Answer ALL Questions (Internal Choice)'
        },
        {
            part: 'C',
            title: 'PART – C',
            subtitle: '(1 × 8 = 8 Marks)',
            questionsCount: 1,
            marksEach: 8,
            totalMarks: 8,
            allowOR: true,
            allowSubQuestions: true,
            fixedMarks: true,
            questionTypes: ['descriptive'],
            description: 'Answer ALL Questions (Internal Choice)'
        }
    ],
    tableColumns: ['Q. No', 'Question', 'CO-K Level', 'Max. Marks'],
    questionNumbering: {
        A: { start: 1, format: 'numeric' },       // 1, 2, 3, 4, 5
        B: { start: 6, format: 'numeric' },        // 6, 7
        C: { start: 8, format: 'numeric' }         // 8
    },
    orFormat: {
        labels: ['(a)', '(b)'],
        separator: 'OR'
    },
    subQuestionFormat: {
        labels: ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)']
    },
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
        margins: { top: 8, right: 10, bottom: 8, left: 10 },
        fontSize: {
            collegeName: 13,
            subtitle: 8,
            examTitle: 11,
            fieldLabel: 9,
            fieldValue: 9,
            sectionTitle: 10.5,
            questionText: 9.5,
            tableHeader: 9,
            tableBody: 9,
            footer: 8
        }
    },

    /**
     * Get default questions for this regulation
     */
    getDefaultQuestions() {
        const questions = [];
        // Part A: 5 questions (2 marks each)
        for (let i = 1; i <= 5; i++) {
            questions.push({
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
        // Part B: 2 questions with OR (16 marks each)
        for (let i = 0; i < 2; i++) {
            const qNum = 6 + i;
            const parentId = 'q_' + Date.now() + '_b' + i;
            questions.push({
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
                sort_order: 6 + i,
                mcq_options: null,
                children: [
                    {
                        id: parentId + '_a',
                        part: 'B',
                        question_number: qNum,
                        question_text: '',
                        question_type: 'descriptive',
                        marks: 16,
                        co: 'CO' + (i + 1),
                        unit: 'Unit ' + (i + 1),
                        k_level: 'K3',
                        parent_id: parentId,
                        or_group: 'a',
                        sub_number: null,
                        sort_order: 0,
                        children: []
                    },
                    {
                        id: parentId + '_b',
                        part: 'B',
                        question_number: qNum,
                        question_text: '',
                        question_type: 'descriptive',
                        marks: 16,
                        co: 'CO' + (i + 1),
                        unit: 'Unit ' + (i + 1),
                        k_level: 'K4',
                        parent_id: parentId,
                        or_group: 'b',
                        sub_number: null,
                        sort_order: 1,
                        children: []
                    }
                ]
            });
        }
        // Part C: 1 question with OR (8 marks: 8(a) and 8(b))
        const parentIdC = 'q_' + Date.now() + '_c';
        questions.push({
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
            children: [
                {
                    id: parentIdC + '_a',
                    part: 'C',
                    question_number: 8,
                    question_text: '',
                    question_type: 'descriptive',
                    marks: 8,
                    co: 'CO3',
                    unit: 'Unit 3',
                    k_level: 'K3',
                    parent_id: parentIdC,
                    or_group: 'a',
                    sub_number: null,
                    sort_order: 0,
                    children: []
                },
                {
                    id: parentIdC + '_b',
                    part: 'C',
                    question_number: 8,
                    question_text: '',
                    question_type: 'descriptive',
                    marks: 8,
                    co: 'CO3',
                    unit: 'Unit 3',
                    k_level: 'K4',
                    parent_id: parentIdC,
                    or_group: 'b',
                    sub_number: null,
                    sort_order: 1,
                    children: []
                }
            ]
        });
        return questions;
    }
};

// Export for use
if (typeof window !== 'undefined') {
    window.REGULATION_21 = REGULATION_21;
}
