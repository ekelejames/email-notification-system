const API_URL = 'http://localhost:3001/api';

let editor;
let currentTemplateId = null;

// Initialize CKEditor
ClassicEditor
    .create(document.querySelector('#editor'), {
        toolbar: ['heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', '|', 
                  'blockQuote', 'insertTable', 'undo', 'redo', '|', 'sourceEditing'],
        height: 400
    })
    .then(newEditor => {
        editor = newEditor;
    })
    .catch(error => {
        console.error(error);
    });

// Load templates
async function loadTemplates() {
    try {
        const response = await fetch(`${API_URL}/templates`);
        const templates = await response.json();
        
        const listContainer = document.getElementById('templateList');
        
        if (templates.length === 0) {
            listContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No templates yet</p>';
            return;
        }
        
        listContainer.innerHTML = templates.map(template => `
            <div class="template-item p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer" 
                 data-id="${template.id}">
                <div class="font-medium text-gray-800">${template.name}</div>
                <div class="text-sm text-gray-500">${template.description || 'No description'}</div>
            </div>
        `).join('');
        
        // Add click handlers
        document.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                loadTemplate(id);
            });
        });
    } catch (error) {
        console.error('Error loading templates:', error);
        alert('Failed to load templates');
    }
}

// Load single template
async function loadTemplate(id) {
    try {
        const response = await fetch(`${API_URL}/templates/${id}`);
        const template = await response.json();
        
        currentTemplateId = id;
        document.getElementById('templateId').value = id;
        document.getElementById('templateName').value = template.name;
        document.getElementById('templateDescription').value = template.description || '';
        document.getElementById('templateSubject').value = template.subject;
        document.getElementById('templateVariables').value = Array.isArray(template.variables) 
            ? template.variables.join(', ') 
            : '';
        
        editor.setData(template.html_content);
        
        document.getElementById('editorContainer').classList.remove('hidden');
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('editorTitle').textContent = `Edit: ${template.name}`;
        document.getElementById('deleteTemplateBtn').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading template:', error);
        alert('Failed to load template');
    }
}

// New template
document.getElementById('newTemplateBtn').addEventListener('click', () => {
    currentTemplateId = null;
    document.getElementById('templateId').value = '';
    document.getElementById('templateForm').reset();
    editor.setData('');
    
    document.getElementById('editorContainer').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('editorTitle').textContent = 'New Template';
    document.getElementById('deleteTemplateBtn').classList.add('hidden');
});

// Save template
document.getElementById('templateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('templateName').value;
    const description = document.getElementById('templateDescription').value;
    const subject = document.getElementById('templateSubject').value;
    const variablesStr = document.getElementById('templateVariables').value;
    const variables = variablesStr ? variablesStr.split(',').map(v => v.trim()).filter(v => v) : [];
    const html_content = editor.getData();
    
    const templateData = {
        name,
        description,
        subject,
        html_content,
        variables
    };
    
    try {
        let response;
        if (currentTemplateId) {
            response = await fetch(`${API_URL}/templates/${currentTemplateId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateData)
            });
        } else {
            response = await fetch(`${API_URL}/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateData)
            });
        }
        
        if (response.ok) {
            const saved = await response.json();
            alert('Template saved successfully!');
            currentTemplateId = saved.id;
            await loadTemplates();
            await loadTemplate(saved.id);
        } else {
            alert('Failed to save template');
        }
    } catch (error) {
        console.error('Error saving template:', error);
        alert('Failed to save template');
    }
});

// Delete template
document.getElementById('deleteTemplateBtn').addEventListener('click', async () => {
    if (!currentTemplateId) return;
    
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
        const response = await fetch(`${API_URL}/templates/${currentTemplateId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Template deleted successfully!');
            currentTemplateId = null;
            document.getElementById('templateForm').reset();
            editor.setData('');
            document.getElementById('editorContainer').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');
            await loadTemplates();
        } else {
            alert('Failed to delete template');
        }
    } catch (error) {
        console.error('Error deleting template:', error);
        alert('Failed to delete template');
    }
});

// Test email
document.getElementById('testEmailBtn').addEventListener('click', () => {
    if (!currentTemplateId) {
        alert('Please save the template first');
        return;
    }
    
    const variables = document.getElementById('templateVariables').value;
    const variableList = variables ? variables.split(',').map(v => v.trim()).filter(v => v) : [];
    
    // Generate sample JSON
    const sampleData = {};
    variableList.forEach(v => {
        if (v !== 'user_name' && v !== 'user_email') {
            sampleData[v] = `sample_${v}`;
        }
    });
    
    document.getElementById('testData').value = JSON.stringify(sampleData, null, 2);
    document.getElementById('testModal').classList.remove('hidden');
});

// Close modal
document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('testModal').classList.add('hidden');
});

// Send test email
document.getElementById('testEmailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const user_name = document.getElementById('testName').value;
    const user_email = document.getElementById('testEmail').value;
    const dataStr = document.getElementById('testData').value;
    
    let data = {};
    try {
        data = dataStr ? JSON.parse(dataStr) : {};
    } catch (error) {
        alert('Invalid JSON in test data');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_name,
                user_email,
                template_id: currentTemplateId,
                data
            })
        });
        
        if (response.ok) {
            alert('Test email queued successfully! Check the recipient inbox.');
            document.getElementById('testModal').classList.add('hidden');
        } else {
            alert('Failed to queue test email');
        }
    } catch (error) {
        console.error('Error sending test email:', error);
        alert('Failed to send test email');
    }
});

// Initialize
loadTemplates();