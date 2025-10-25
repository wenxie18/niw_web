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
            // Only clear errors on input, don't validate until navigation
            this.clearFieldErrors();
        });

        // Form submission
        document.getElementById('surveyForm').addEventListener('submit', (e) => this.submitForm(e));

        // Auto-save on page unload
        window.addEventListener('beforeunload', () => this.saveFormData());
    }

    showStep(step) {
        // Hide all sections
        const sections = document.querySelectorAll('.form-section, .survey-section');
        sections.forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
        });

        // Show current section
        const currentSection = document.querySelector(`[data-section="${step}"]`);
        if (currentSection) {
            currentSection.classList.add('active');
            currentSection.style.display = 'block';
        }

        // Update navigation buttons
        this.updateNavigationButtons();
        this.updateProgress();
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
        
        // Add/remove CSS classes for better control
        if (this.currentStep > 1) {
            prevBtn.classList.remove('hidden');
        } else {
            prevBtn.classList.add('hidden');
        }

        // Show/hide next/submit buttons
        if (this.currentStep === this.totalSteps) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-flex';
            
            // Add/remove CSS classes
            nextBtn.classList.add('hidden');
            submitBtn.classList.remove('hidden');
        } else {
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
            
            // Add/remove CSS classes
            nextBtn.classList.remove('hidden');
            submitBtn.classList.add('hidden');
        }
    }

    validateCurrentStep() {
        const currentSection = document.querySelector(`[data-section="${this.currentStep}"]`);
        if (!currentSection) {
            console.error('Current section not found for step:', this.currentStep);
            return false;
        }
        
        const requiredFields = currentSection.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;
        let missingFields = [];

        // Clear previous error styling
        requiredFields.forEach(field => {
            field.classList.remove('error');
        });

        // Check each required field
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                field.classList.add('error');
                
                // Get field label for error message
                const label = currentSection.querySelector(`label[for="${field.id}"]`);
                const fieldName = label ? label.textContent.replace('*', '').trim() : field.name;
                missingFields.push(fieldName);
            }
        });

        // Additional validation for specific fields (only if they have values)
        if (this.currentStep === 1) {
            const email = document.getElementById('PERSONAL_EMAIL');
            if (email.value && !this.isValidEmail(email.value)) {
                isValid = false;
                email.classList.add('error');
                missingFields.push('Valid email address');
            }

            const state = document.getElementById('PERSONAL_STATE');
            if (state.value && state.value.length !== 2) {
                isValid = false;
                state.classList.add('error');
                missingFields.push('2-letter state code');
            }
        }

        if (this.currentStep === 2) {
            const uscisState = document.getElementById('USCIS_STATE');
            if (uscisState.value && uscisState.value.length !== 2) {
                isValid = false;
                uscisState.classList.add('error');
                missingFields.push('2-letter state code');
            }
        }

        // Show error message if validation fails
        if (!isValid) {
            this.showValidationError(missingFields);
        } else {
            this.hideValidationError();
        }

        return isValid;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showValidationError(missingFields) {
        // Remove existing error message
        this.hideValidationError();
        
        // Create error message
        const errorDiv = document.createElement('div');
        errorDiv.id = 'validation-error';
        errorDiv.className = 'validation-error';
        errorDiv.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Please complete all required fields</h3>
                <p>The following fields are required before proceeding:</p>
                <ul>
                    ${missingFields.map(field => `<li>${field}</li>`).join('')}
                </ul>
            </div>
        `;
        
        // Insert error message after the current section
        const currentSection = document.querySelector(`[data-section="${this.currentStep}"]`);
        if (currentSection) {
            currentSection.insertAdjacentElement('afterend', errorDiv);
            
            // Scroll to error message
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    hideValidationError() {
        const existingError = document.getElementById('validation-error');
        if (existingError) {
            existingError.remove();
        }
    }

    clearFieldErrors() {
        // Clear error styling from all fields
        const errorFields = document.querySelectorAll('.form-group input.error, .form-group select.error, .form-group textarea.error');
        errorFields.forEach(field => {
            field.classList.remove('error');
        });
    }

    saveFormData() {
        const form = document.getElementById('surveyForm');
        const formData = new FormData(form);
        
        // Convert FormData to object
        for (let [key, value] of formData.entries()) {
            this.formData[key] = value;
        }

        // Determine which survey this is and use appropriate key
        const isSecondSurvey = window.location.pathname.includes('second-survey');
        const storageKey = isSecondSurvey ? 'secondSurveyData' : 'niwSurveyData';
        
        // Add current section to saved data
        this.formData.currentSection = this.currentStep;
        
        // Save to localStorage
        localStorage.setItem(storageKey, JSON.stringify(this.formData));
        
        // Show auto-save indicator
        this.showAutoSaveIndicator();
    }

    loadSavedData() {
        // Determine which survey this is and use appropriate key
        const isSecondSurvey = window.location.pathname.includes('second-survey');
        const storageKey = isSecondSurvey ? 'secondSurveyData' : 'niwSurveyData';
        
        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
            try {
                this.formData = JSON.parse(savedData);
                
                // Restore current section if available
                if (this.formData.currentSection !== undefined) {
                    this.currentStep = this.formData.currentSection;
                    this.showStep(this.currentStep);
                }
                
                this.populateForm();
                console.log('Form data restored from localStorage');
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
            const isSecondSurvey = window.location.pathname.includes('second-survey');
            const storageKey = isSecondSurvey ? 'secondSurveyData' : 'niwSurveyData';
            localStorage.removeItem(storageKey);
            
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
        // Get the registered user's email from localStorage instead of form data
        let registeredEmail = null;
        try {
            const accountData = JSON.parse(localStorage.getItem('niw_account') || '{}');
            registeredEmail = accountData.email;
        } catch (e) {
            console.error('Error loading account data:', e);
        }
        
        // Debug: Log form data to see what we have
        console.log('Form data before submission:', {
            hasPersonalEmail: !!this.formData.PERSONAL_EMAIL,
            personalEmailValue: this.formData.PERSONAL_EMAIL,
            registeredEmail: registeredEmail,
            usingRegisteredEmail: !!registeredEmail,
            formDataKeys: Object.keys(this.formData).slice(0, 10)
        });
        
        // Submit to the actual API using registered email, not form email
        const response = await fetch('/api/submit-survey', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: registeredEmail || this.formData.PERSONAL_EMAIL, // Fallback to form email if no registered email
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

    showAutoSaveIndicator() {
        // Remove existing indicator
        const existingIndicator = document.getElementById('auto-save-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Create indicator
        const indicator = document.createElement('div');
        indicator.id = 'auto-save-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        indicator.textContent = 'Auto-saved';
        
        document.body.appendChild(indicator);
        
        // Show indicator
        setTimeout(() => {
            indicator.style.opacity = '1';
        }, 10);
        
        // Hide indicator after 2 seconds
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
        }, 2000);
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

