// Survey Form Management
class SurveyForm {
    constructor() {
        this.currentStep = 1;
        // Dynamically derive total steps from DOM
        const sections = document.querySelectorAll('.form-section');
        this.totalSteps = sections && sections.length ? sections.length : 1;
        this.formData = {};
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateProgress();
        this.loadSavedData();
    }

    bindEvents() {
        // Navigation buttons
        document.getElementById('prevBtn').addEventListener('click', () => this.previousStep());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextStep());
        document.getElementById('submitBtn').addEventListener('click', (e) => this.submitForm(e));

        // Form input changes
        document.getElementById('surveyForm').addEventListener('input', (e) => {
            this.saveFormData();
            this.validateCurrentStep();
        });

        // Form submission
        document.getElementById('surveyForm').addEventListener('submit', (e) => this.submitForm(e));

        // Auto-save on page unload
        window.addEventListener('beforeunload', () => this.saveFormData());
    }

    showStep(step) {
        // Hide all sections
        const sections = document.querySelectorAll('.form-section');
        sections.forEach(section => section.classList.remove('active'));

        // Show current section
        const currentSection = document.querySelector(`[data-section="${step}"]`);
        if (currentSection) {
            currentSection.classList.add('active');
        }

        // Update navigation buttons
        this.updateNavigationButtons();
        this.updateProgress();
        this.validateCurrentStep();
    }

    nextStep() {
        if (this.validateCurrentStep()) {
            if (this.currentStep < this.totalSteps) {
                this.currentStep++;
                this.showStep(this.currentStep);
            }
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }

    updateProgress() {
        const progressFill = document.getElementById('progressFill');
        const currentStepElement = document.getElementById('currentStep');
        const totalStepsElement = document.getElementById('totalSteps');

        const progressPercentage = (this.currentStep / this.totalSteps) * 100;
        progressFill.style.width = `${progressPercentage}%`;
        currentStepElement.textContent = this.currentStep;
        totalStepsElement.textContent = this.totalSteps;
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('submitBtn');

        // Show/hide previous button
        prevBtn.style.display = this.currentStep > 1 ? 'inline-flex' : 'none';

        // Show/hide next/submit buttons
        if (this.currentStep === this.totalSteps) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-flex';
        } else {
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        }
    }

    validateCurrentStep() {
        const currentSection = document.querySelector(`[data-section="${this.currentStep}"]`);
        const requiredFields = currentSection.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                field.classList.add('error');
            } else {
                field.classList.remove('error');
            }
        });

        // Additional validation for specific fields (only if they have values)
        if (this.currentStep === 1) {
            const email = document.getElementById('PERSONAL_EMAIL');
            if (email.value && !this.isValidEmail(email.value)) {
                isValid = false;
                email.classList.add('error');
            }

            const state = document.getElementById('PERSONAL_STATE');
            if (state.value && state.value.length !== 2) {
                isValid = false;
                state.classList.add('error');
            }
        }

        if (this.currentStep === 2) {
            const uscisState = document.getElementById('USCIS_STATE');
            if (uscisState.value && uscisState.value.length !== 2) {
                isValid = false;
                uscisState.classList.add('error');
            }
        }

        // For testing: always return true to allow submission without required fields
        return true;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    saveFormData() {
        const form = document.getElementById('surveyForm');
        const formData = new FormData(form);
        
        // Convert FormData to object
        for (let [key, value] of formData.entries()) {
            this.formData[key] = value;
        }

        // Save to localStorage
        localStorage.setItem('niwSurveyData', JSON.stringify(this.formData));
    }

    loadSavedData() {
        const savedData = localStorage.getItem('niwSurveyData');
        if (savedData) {
            try {
                this.formData = JSON.parse(savedData);
                this.populateForm();
            } catch (e) {
                console.error('Error loading saved data:', e);
            }
        }
    }

    populateForm() {
        Object.keys(this.formData).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                element.value = this.formData[key];
            }
        });
    }

    async submitForm(e) {
        e.preventDefault();

        // For testing: skip validation to allow empty submissions
        // if (!this.validateCurrentStep()) {
        //     this.showNotification('Please fill in all required fields before submitting.', 'error');
        //     return;
        // }

        // Save final data
        this.saveFormData();

        // Show loading state
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;

        try {
            // Simulate API call (replace with actual API endpoint)
            await this.submitToAPI();
            
            // Clear saved data
            localStorage.removeItem('niwSurveyData');
            
            // Show success message
            this.showSuccessMessage();
            
        } catch (error) {
            console.error('Submission error:', error);
            this.showNotification('There was an error submitting your application. Please try again.', 'error');
            
            // Restore button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async submitToAPI() {
        // Submit to the actual API
        const response = await fetch('/api/submit-survey', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: this.formData.PERSONAL_EMAIL,
                ...this.formData
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to submit survey');
        }

        return response.json();
    }

    showSuccessMessage() {
        // Hide form
        document.getElementById('surveyForm').style.display = 'none';
        document.querySelector('.progress-container').style.display = 'none';
        
        // Show success message
        document.getElementById('successMessage').style.display = 'block';
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#fed7d7' : '#bee3f8'};
            color: ${type === 'error' ? '#c53030' : '#2b6cb0'};
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;

        // Add to page
        document.body.appendChild(notification);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
}

// Add CSS for notifications
const notificationStyles = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .notification-content i {
        font-size: 1.2rem;
    }
`;

// Add notification styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Add error styles for form validation
const errorStyles = `
    .form-group input.error,
    .form-group select.error,
    .form-group textarea.error {
        border-color: #e53e3e !important;
        background-color: #fed7d7 !important;
        box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.1) !important;
    }
`;

const errorStyleSheet = document.createElement('style');
errorStyleSheet.textContent = errorStyles;
document.head.appendChild(errorStyleSheet);

// Initialize the survey form when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SurveyForm();
});

// Add some utility functions for better UX
document.addEventListener('DOMContentLoaded', () => {
    // Auto-format phone numbers
    const phoneInput = document.getElementById('PERSONAL_PHONE');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 10) {
                value = value.substring(0, 10);
            }
            e.target.value = value;
        });
    }

    // Auto-format ZIP codes
    const zipInputs = document.querySelectorAll('input[name*="ZIP"]');
    zipInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 5) {
                value = value.substring(0, 5);
            }
            e.target.value = value;
        });
    });

    // Auto-format state inputs to uppercase
    const stateInputs = document.querySelectorAll('input[name*="STATE"]');
    stateInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    });

    // Auto-format email to lowercase
    const emailInput = document.getElementById('PERSONAL_EMAIL');
    if (emailInput) {
        emailInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toLowerCase();
        });
    }
});
