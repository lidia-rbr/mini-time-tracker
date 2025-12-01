/**
 * Mini Time Tracker - Cleaned Vanilla JS Implementation
 * Features: Project Tracking, LocalStorage Persistence, Sydney Clock
 */

// --- Configuration & Global State ---
const LOCAL_STORAGE_KEY = 'miniTimeTrackerProjects';
const CLOCK_ELEMENT_ID = 'currentClock';
const PROJECT_LIST_ELEMENT_ID = 'projectList';
const ADD_PROJECT_BTN_ID = 'addProjectBtn';
const PROJECT_INPUT_ID = 'newProjectName';
const THEME_TOGGLE_ID = 'themeToggle';
const THEME_STORAGE_KEY = 'theme';

// State variables (using an Object for projects for easier ID lookups)
let projects = {}; // { id: { name, totalSeconds, startTime } }
let activeProjectId = null;
let timerInterval; // Used for saving/updating the tracking time (if needed, though requestAnimationFrame is cleaner)


/**
 * Updates the icon and saves the theme preference.
 * @param {string} theme - The theme name ('light' or 'dark').
 */
function updateThemeIcon(theme) {
    const themeToggle = document.getElementById(THEME_TOGGLE_ID);
    if (!themeToggle) return;

    // We expect the icon to be inside the button, or update the button text directly
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/**
 * Initializes and handles the theme switching functionality.
 */
function initializeThemeToggle() {
    const html = document.documentElement;
    const themeToggle = document.getElementById(THEME_TOGGLE_ID);

    if (!themeToggle) return; // Exit if the button doesn't exist

    // Load theme preference
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light'; // Default to light if not set
    html.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        // Apply and Save
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        updateThemeIcon(newTheme);
    });
}


// --- Utility Functions ---

/**
 * Converts total seconds into HH:MM:SS format.
 * @param {number} totalSeconds - Total time in seconds.
 * @returns {string} Formatted time string.
 */
function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Updates the Sydney time clock display.
 */
function updateSydneyTime() {
    const clockElement = document.getElementById(CLOCK_ELEMENT_ID);
    if (!clockElement) return;

    const now = new Date();

    // Using the 'en-AU' locale and 'Australia/Sydney' timezone
    const sydneyTime = now.toLocaleTimeString('en-AU', {
        timeZone: 'Australia/Sydney',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 24-hour format
    });

    clockElement.textContent = sydneyTime;
}


// --- Local Storage Functions ---

function loadProjects() {
    const storedProjects = localStorage.getItem(LOCAL_STORAGE_KEY);
    console.log("stored projects:", storedProjects);

    // Default to an empty object map
    projects = {};
    let loadedActiveId = null; // Temporary variable to hold potential active ID

    if (storedProjects) {
        try {
            const parsedData = JSON.parse(storedProjects);

            if (typeof parsedData === 'object' && parsedData !== null) {
                // If the stored data included an activeProjectId, retrieve it
                if ('projects' in parsedData) {
                    loadedActiveId = parsedData.activeProjectId;
                    projects = parsedData.projects;
                } else {
                    // Assume the stored data is just the 'projects' object itself
                    projects = parsedData;
                }
            }
        } catch (e) {
            console.error("Failed to parse projects from LocalStorage, resetting data.", e);
        }
    }

    // IMPORTANT: Check if the loaded active ID actually exists in the loaded projects.
    if (loadedActiveId && projects[loadedActiveId]) {
        activeProjectId = loadedActiveId;
    } else {
        activeProjectId = null;
    }

    // ALSO: If any loaded project thinks it's running but isn't the active one, clear its startTime
    Object.values(projects).forEach(project => {
        if (project !== activeProjectId && project.startTime) {
            project.startTime = null;
        }
    });
}

function saveProjects() {
    const dataToStore = {
        projects: projects,
        activeProjectId: activeProjectId
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToStore));
}


// --- Rendering & UI Functions ---

/**
 * Main function to redraw the project list.
 * Note: We now use map/join for cleaner rendering and attached event listeners dynamically.
 */
// --- Rendering & UI Functions ---

function renderProjects() {
    const list = document.getElementById(PROJECT_LIST_ELEMENT_ID);
    list.innerHTML = '';

    // Create a clean list of projects to render
    const validProjectEntries = Object.entries(projects).filter(([, project]) => {
        return project && typeof project === 'object';
    });

    // Fix stray running startTimes (compare IDs properly)
    validProjectEntries.forEach(([id, project]) => {
        if (id !== activeProjectId && project.startTime) {
            project.startTime = null;
        }
    });

    // Event delegation
    list.removeEventListener('click', handleProjectAction);
    list.addEventListener('click', handleProjectAction);

    // Empty state
    if (validProjectEntries.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⏱️</div>
                <p>No projects yet. Add one to get started!</p>
            </div>
        `;
        return;
    }

    // Render each project
    console.log("Rendering projects:", validProjectEntries);

    validProjectEntries.forEach(([id, project]) => {
        console.log("Rendering project:", id, project);

        let displaySeconds = project.totalSeconds;
        const isRunning = activeProjectId === id;

        if (isRunning && project.startTime) {
            const elapsed = Math.floor((Date.now() - project.startTime) / 1000);
            displaySeconds += elapsed;
        }

        const projectDiv = document.createElement('div');
        projectDiv.classList.add('project');
        projectDiv.dataset.id = id;

        projectDiv.innerHTML = `
            <div class="project-name">${project.name}</div>
            <div class="project-controls">
                <div class="total-time" data-time-display-id="${id}">
                    ${formatTime(displaySeconds)}
                </div>
                <button class="start-stop-btn ${isRunning ? 'running' : ''}"
                        data-action="toggle"
                        data-id="${id}"
                        ${isRunning ? '' : activeProjectId ? 'disabled' : ''}>
                    ${isRunning ? 'Stop' : 'Start'}
                </button>
                <button class="delete-btn" data-action="delete" data-id="${id}">
                    Delete
                </button>
            </div>
        `;

        list.appendChild(projectDiv);
    });
}


/**
 * Updates the time display for the currently active project.
 * Uses requestAnimationFrame for smooth, browser-optimized updates.
 */
function updateActiveTimerDisplay() {
    if (!activeProjectId) return;

    const project = projects[activeProjectId];
    const timeDisplay = document.querySelector(`[data-time-display-id="${activeProjectId}"]`);

    if (project && project.startTime && timeDisplay) {
        const elapsed = Math.floor((Date.now() - project.startTime) / 1000);
        const totalDisplayTime = project.totalSeconds + elapsed;

        timeDisplay.textContent = formatTime(totalDisplayTime);

        // NEW: update global active elapsed display
        updateActiveTotalElapsed();
        updateActiveProjectDisplay();

        requestAnimationFrame(updateActiveTimerDisplay);
    }
}

/**
 * Renders the currently active project's name and total elapsed time
 * in the header section under the Sydney clock.
 */
function updateActiveProjectDisplay() {
    const el = document.getElementById('activeProjectDisplay');
    if (!el) return;

    if (!activeProjectId) {
        el.innerHTML = '';
        return;
    }

    const project = projects[activeProjectId];
    if (!project) {
        el.innerHTML = '';
        return;
    }

    let seconds = project.totalSeconds;

    if (project.startTime) {
        seconds += Math.floor((Date.now() - project.startTime) / 1000);
    }

    el.innerHTML = `
        <div class="project-name">${project.name}</div>
        <div class="project-time">${formatTime(seconds)}</div>
    `;
}


// --- Core Timer Logic ---

/**
 * Handles Start/Stop based on project ID.
 */
function toggleTimer(id) {
    if (activeProjectId === id) {
        stopTimer(id);
    } else {
        // If a different project is active, stop it first
        if (activeProjectId) {
            stopTimer(activeProjectId);
        }
        startTimer(id);
    }
    // Re-render to update all button states
    renderProjects();
}

/**
 * Logic for starting a timer.
 */
function startTimer(id) {
    projects[id].startTime = Date.now();
    activeProjectId = id;

    // Start the continuous display update loop
    updateActiveTimerDisplay();
    updateActiveProjectDisplay()
}

/**
 * Logic for stopping a timer.
 */
function stopTimer(id) {
    const project = projects[id];

    // Calculate the elapsed time since the timer started
    if (project.startTime) {
        const elapsed = Math.floor((Date.now() - project.startTime) / 1000);
        project.totalSeconds += elapsed;
        project.startTime = null;
    }

    activeProjectId = null;

    // Save the final logged time
    saveProjects();
    updateActiveProjectDisplay();
}

/**
 * Logic for deleting a project.
 */
function deleteProject(id) {
    if (!confirm('Are you sure you want to delete this project and all recorded time?')) {
        return;
    }
    // Stop the timer if it's currently running
    if (activeProjectId === id) {
        stopTimer(id);
    }
    delete projects[id];
    saveProjects();
    renderProjects();
}


// --- Project Management Functions ---

function addProject() {
    const input = document.getElementById(PROJECT_INPUT_ID);
    const name = input.value.trim();

    if (!name) return;

    // Use a unique ID (Date.now() works fine, converted to string for object key)
    const id = Date.now().toString();

    projects[id] = {
        name: name,
        totalSeconds: 0, // Total accumulated time
        startTime: null   // Timestamp when the timer was started
    };

    input.value = ''; // Clear input
    saveProjects();
    renderProjects();
}


// --- Event Delegation Handler ---

function handleProjectAction(event) {
    const target = event.target;
    const action = target.dataset.action;
    const id = target.dataset.id;

    if (action === 'toggle') {
        toggleTimer(id);
    } else if (action === 'delete') {
        deleteProject(id);
    }
}

/**
 * Displays the total elapsed time for the currently active project.
 */
function updateActiveTotalElapsed() {
    const el = document.getElementById('activeTotalTime');
    if (!el) return;

    if (!activeProjectId) {
        el.textContent = '';
        return;
    }

    const project = projects[activeProjectId];
    if (!project) {
        el.textContent = '';
        return;
    }

    let seconds = project.totalSeconds;

    if (project.startTime) {
        const elapsed = Math.floor((Date.now() - project.startTime) / 1000);
        seconds += elapsed;
    }

    console.log("project", project)

    el.textContent = `${project.name} elapsed: ${formatTime(seconds)}`;
}


// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load data
    loadProjects();

    // 2. Set up Add Project listeners
    document.getElementById(ADD_PROJECT_BTN_ID).addEventListener('click', addProject);
    document.getElementById(PROJECT_INPUT_ID).addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addProject();
    });

    // 3. Initialize Theme Toggle 
    initializeThemeToggle();

    // Lines removed here: updateSydneyTime() and setInterval(...)
    updateSydneyTime();
    setInterval(updateSydneyTime, 1000);

    // 4. Initial project rendering
    renderProjects();

    // 5. If a project was running (which we cleared on load), restart the display update
    if (activeProjectId) {
        updateActiveTimerDisplay();
    }
});