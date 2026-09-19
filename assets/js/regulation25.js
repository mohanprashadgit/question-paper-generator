/**
 * Grace College Question Paper Generator
 * Regulation 25 Template Definition
 */
const REGULATION_25 = {
    name: '25 Regulation',
    code: '25',
    totalMarks: 50,
    sections: [
        {
            part: 'A',
            title: 'PART – A',
            subtitle: '(5 × 1 = 5 Marks)',
            questionsCount: 5,
            marksEach: 1,
            totalMarks: 5,
            allowOR: false,
            allowSubQuestions: false,
            fixedMarks: true,
            questionTypes: ['mcq', 'descriptive'],
            description: 'Answer ALL Questions'
        },
        {
            part: 'B',
            title: 'PART – B',
            subtitle: '(3 × 3 = 9 Marks)',
            questionsCount: 3,
            marksEach: 3,
            totalMarks: 9,
            allowOR: false,
            allowSubQuestions: false,
            fixedMarks: true,
            questionTypes: ['descriptive'],
            description: 'Answer ALL Questions'
        },
        {
            part: 'C',
            title: 'PART – C',
            subtitle: '(3 × 12 = 36 Marks)',
            questionsCount: 3,
            marksEach: 12,
            totalMarks: 36,
            allowOR: true,
            allowSubQuestions: true,
            fixedMarks: true,
            questionTypes: ['descriptive'],
            description: 'Answer ALL Questions (Internal Choice)'
        }
    ],
    tableColumns: ['Q. No', 'Question', 'CO-K Level', 'Max. Marks'],
    questionNumbering: {
        A: { start: 1, format: 'numeric' },
        B: { start: 6, format: 'numeric' },
        C: { start: 9, format: 'numeric' }
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
        // Part A: 5 questions (1 mark each)
        for (let i = 1; i <= 5; i++) {
            questions.push({
                id: 'q25_' + Date.now() + '_a' + i,
                part: 'A',
                question_number: i,
                question_text: '',
                question_type: 'mcq',
                marks: 1,
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
                mcq_options: [
                    { label: 'A', text: '', isCorrect: false },
                    { label: 'B', text: '', isCorrect: false },
                    { label: 'C', text: '', isCorrect: false },
                    { label: 'D', text: '', isCorrect: false }
                ],
                children: []
            });
        }
        // Part B: 3 questions (3 marks each) - direct 6, 7, 8 without OR options
        for (let i = 0; i < 3; i++) {
            const qNum = 6 + i;
            questions.push({
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
            });
        }
        // Part C: 3 questions (12 marks each) with OR (9, 10, 11)
        for (let i = 0; i < 3; i++) {
            const qNum = 9 + i;
            const parentId = 'q25_' + Date.now() + '_c' + i;
            questions.push({
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
                children: [
                    {
                        id: parentId + '_a',
                        part: 'C',
                        question_number: qNum,
                        question_text: '',
                        question_type: 'descriptive',
                        marks: 12,
                        co: 'CO' + (i + 2),
                        unit: 'Unit ' + (i + 2),
                        k_level: 'K4',
                        parent_id: parentId,
                        or_group: 'a',
                        sub_number: null,
                        sort_order: 0,
                        children: []
                    },
                    {
                        id: parentId + '_b',
                        part: 'C',
                        question_number: qNum,
                        question_text: '',
                        question_type: 'descriptive',
                        marks: 12,
                        co: 'CO' + (i + 2),
                        unit: 'Unit ' + (i + 2),
                        k_level: 'K5',
                        parent_id: parentId,
                        or_group: 'b',
                        sub_number: null,
                        sort_order: 1,
                        children: []
                    }
                ]
            });
        }
        return questions;
    }
};

if (typeof window !== 'undefined') {
    window.REGULATION_25 = REGULATION_25;
}
