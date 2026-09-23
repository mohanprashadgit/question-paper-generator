/**
 * Validation Engine
 * Real-time validation for question papers
 * Grace College Question Paper Generator
 */
const Validation = {
    /**
     * Validate the entire paper and return errors
     */
    validate(paperData, regulation) {
        const errors = [];
        const warnings = [];
        const template = (typeof App !== 'undefined' && App.getTemplate) ? App.getTemplate(regulation) : (regulation === '25' ? REGULATION_25 : REGULATION_21);

        // 1. Paper details validation
        if (!paperData.course_code) errors.push({ field: 'course_code', message: 'Course Code is required', section: 'details' });
        if (!paperData.course_name) errors.push({ field: 'course_name', message: 'Course Name is required', section: 'details' });
        if (!paperData.programme) errors.push({ field: 'programme', message: 'Programme is required', section: 'details' });

        // 2. Section-wise validation
        const questions = paperData.questions || [];
        let totalMarks = 0;
        let totalQuestions = 0;

        template.sections.forEach(section => {
            const sectionQuestions = questions.filter(q => q.part === section.part && !q.parent_id);
            const sectionMarks = this.calculateSectionMarks(sectionQuestions, section);
            totalMarks += sectionMarks.effective;
            totalQuestions += sectionQuestions.length;

            // Check question count
            if (sectionQuestions.length < section.questionsCount) {
                errors.push({
                    field: 'section_' + section.part,
                    message: `Part ${section.part}: Expected ${section.questionsCount} questions, found ${sectionQuestions.length}`,
                    section: section.part
                });
            }

            // Check marks
            if (sectionMarks.effective !== section.totalMarks) {
                errors.push({
                    field: 'marks_' + section.part,
                    message: `Part ${section.part}: Expected ${section.totalMarks} marks, calculated ${sectionMarks.effective}`,
                    section: section.part
                });
            }

            // Validate each question
            sectionQuestions.forEach((q, idx) => {
                const qLabel = this.getQuestionLabel(q);
                const hasOR = q.children && q.children.some(c => c.or_group);

                if (!hasOR) {
                    if (this.isTextEmpty(q.question_text)) {
                        errors.push({
                            field: 'question_text',
                            message: `${qLabel}: Question text is empty`,
                            section: section.part,
                            questionId: q.id
                        });
                    }

                    if (!q.co) {
                        errors.push({ field: 'co', message: `${qLabel}: CO not selected`, section: section.part, questionId: q.id });
                    }
                    if (!q.unit) {
                        errors.push({ field: 'unit', message: `${qLabel}: Unit not selected`, section: section.part, questionId: q.id });
                    }
                    if (!q.k_level) {
                        errors.push({ field: 'k_level', message: `${qLabel}: K-Level not selected`, section: section.part, questionId: q.id });
                    }
                } else {
                    // OR question validation
                    const orA = q.children.find(c => c.or_group === 'a');
                    const orB = q.children.find(c => c.or_group === 'b');

                    if (!orA || this.isTextEmpty(orA.question_text)) {
                        errors.push({
                            field: 'question_text',
                            message: `Q${q.question_number}(a): Question text is empty`,
                            section: section.part,
                            questionId: orA ? orA.id : q.id
                        });
                    }
                    if (!orB || this.isTextEmpty(orB.question_text)) {
                        errors.push({
                            field: 'question_text',
                            message: `Q${q.question_number}(b): Question text is empty`,
                            section: section.part,
                            questionId: orB ? orB.id : q.id
                        });
                    }

                    if (orA && !orA.co) {
                        errors.push({ field: 'co', message: `Q${q.question_number}(a): CO not selected`, section: section.part, questionId: orA.id });
                    }
                    if (orB && !orB.co) {
                        errors.push({ field: 'co', message: `Q${q.question_number}(b): CO not selected`, section: section.part, questionId: orB.id });
                    }

                    // Subquestion marks sum check if any
                    const subQuestions = q.children.filter(c => c.sub_number);
                    if (subQuestions.length > 0) {
                        const subTotal = subQuestions.reduce((sum, s) => sum + (parseInt(s.marks) || 0), 0);
                        if (subTotal !== parseInt(q.marks)) {
                            warnings.push({
                                message: `${qLabel}: Subquestion marks (${subTotal}) don't match parent marks (${q.marks})`,
                                section: section.part,
                                questionId: q.id
                            });
                        }
                    }
                }
            });
        });

        // 3. Total marks validation
        if (totalMarks !== template.totalMarks) {
            errors.push({
                field: 'total_marks',
                message: `Total marks: Expected ${template.totalMarks}, calculated ${totalMarks}`,
                section: 'total'
            });
        }

        return { errors, warnings, totalMarks, totalQuestions, isValid: errors.length === 0 };
    },

    /**
     * Calculate effective marks for a section (handling OR questions)
     */
    calculateSectionMarks(questions, section) {
        let total = 0;
        questions.forEach(q => {
            if (q.children && q.children.length > 0) {
                // For OR questions, count max of the OR options (they're alternatives)
                const orChildren = q.children.filter(c => c.or_group);
                if (orChildren.length > 0) {
                    total += parseInt(orChildren[0]?.marks || q.marks) || 0;
                } else {
                    total += parseInt(q.marks) || 0;
                }
            } else {
                total += parseInt(q.marks) || 0;
            }
        });
        return { total, effective: total };
    },

    /**
     * Get human-readable question label
     */
    getQuestionLabel(q) {
        let label = `Q${q.question_number}`;
        if (q.or_group) label += `(${q.or_group})`;
        if (q.sub_number) label += ` ${q.sub_number}`;
        return label;
    },

    /**
     * Render validation summary in UI
     */
    renderValidationSummary(validation) {
        const container = document.getElementById('validationDetails');
        if (!container) return;

        let html = '';

        if (validation.isValid) {
            html += `
                <div style="text-align:center; padding:20px;">
                    <div style="font-size:48px; margin-bottom:8px;">✅</div>
                    <h3 style="color:var(--success)">All Validations Passed!</h3>
                    <p style="color:var(--text-muted)">Your paper is ready for preview and PDF export.</p>
                </div>`;
        } else {
            if (validation.errors.length > 0) {
                html += `<h4 style="color:var(--error); margin-bottom:8px;">❌ Errors (${validation.errors.length})</h4>`;
                html += '<ul class="error-list">';
                validation.errors.forEach(err => {
                    const onclick = err.questionId ? `onclick="QuestionBuilder.scrollToQuestion('${err.questionId}')"` : '';
                    html += `<li ${onclick}>⚠️ ${err.message}</li>`;
                });
                html += '</ul>';
            }
            if (validation.warnings.length > 0) {
                html += `<h4 style="color:var(--warning); margin:12px 0 8px;">⚠️ Warnings (${validation.warnings.length})</h4>`;
                html += '<ul class="error-list">';
                validation.warnings.forEach(w => {
                    html += `<li style="background:var(--warning-bg); color:var(--warning);">⚠ ${w.message}</li>`;
                });
                html += '</ul>';
            }
        }

        container.innerHTML = html;

        // Update badge
        const badge = document.getElementById('globalValidation');
        if (badge) {
            if (validation.isValid) {
                badge.className = 'validation-badge valid';
                badge.innerHTML = '✓ Marks Valid';
            } else {
                badge.className = 'validation-badge invalid';
                badge.innerHTML = `⚠ ${validation.errors.length} Error(s)`;
            }
        }
    },

    /**
     * Check if HTML content is effectively empty
     */
    isTextEmpty(html) {
        if (!html) return true;
        // Strip HTML tags and entities to check for actual printable characters
        const stripped = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        return stripped === '';
    },

    /**
     * Get section validation status
     */
    getSectionStatus(questions, section) {
        const sectionQs = questions.filter(q => q.part === section.part && !q.parent_id);
        const marks = this.calculateSectionMarks(sectionQs, section);
        const countOk = sectionQs.length === section.questionsCount;
        const marksOk = marks.effective === section.totalMarks;
        const allFilled = sectionQs.every(q => {
            const hasOR = q.children && q.children.some(c => c.or_group);
            if (hasOR) {
                const orA = q.children.find(c => c.or_group === 'a');
                const orB = q.children.find(c => c.or_group === 'b');
                return orA && orB && !this.isTextEmpty(orA.question_text) && !this.isTextEmpty(orB.question_text);
            }
            return !this.isTextEmpty(q.question_text);
        });

        return {
            countOk,
            marksOk,
            allFilled,
            isValid: countOk && marksOk && allFilled,
            currentCount: sectionQs.length,
            currentMarks: marks.effective
        };
    }
};
