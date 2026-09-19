/**
 * Help Module
 * Tooltips and contextual help
 * Grace College Question Paper Generator
 */
const Help = {
    tooltips: {
        co: 'Course Outcome (CO) - Defines what a student should be able to do after completing the course. Select CO1 through CO6.',
        unit: 'The syllabus unit (1-6) from which this question is drawn.',
        k_level: "Bloom's Taxonomy level: K1=Remember, K2=Understand, K3=Apply, K4=Analyze, K5=Evaluate, K6=Create.",
        co_k: 'Combined CO-K notation (e.g., CO1-K3) is automatically generated from your CO and K-Level selections.',
        marks: 'The maximum marks allocated to this question.',
        competency: 'Auto-generated analysis showing how questions map to each Bloom\'s Taxonomy level with mark distribution.',
        or_question: 'Two alternative questions (a) and (b). Students answer only one. Both must have the same marks.'
    },

    init() {
        // Tooltip triggers are handled by CSS :hover::after using data-tooltip attribute
        // This module provides the help page content and global help button
    }
};
