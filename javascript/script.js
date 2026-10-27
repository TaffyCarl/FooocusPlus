// based on https://github.com/AUTOMATIC1111/stable-diffusion-webui/blob/v1.6.0/script.js
function gradioApp() {
    const elems = document.getElementsByTagName('gradio-app');
    const elem = elems.length == 0 ? document : elems[0];

    if (elem !== document) {
        elem.getElementById = function(id) {
            return document.getElementById(id);
        };
    }
    return elem.shadowRoot ? elem.shadowRoot : elem;
}

/**
 * Get the currently selected top-level UI tab button (e.g. the button that says "Extras").
 */
function get_uiCurrentTab() {
    return gradioApp().querySelector('#tabs > .tab-nav > button.selected');
}

/**
 * Get the first currently visible top-level UI tab content (e.g. the div hosting the "txt2img" UI).
 */
function get_uiCurrentTabContent() {
    return gradioApp().querySelector('#tabs > .tabitem[id^=tab_]:not([style*="display: none"])');
}

var uiUpdateCallbacks = [];
var uiAfterUpdateCallbacks = [];
var uiLoadedCallbacks = [];
var uiTabChangeCallbacks = [];
var optionsChangedCallbacks = [];
var uiAfterUpdateTimeout = null;
var uiCurrentTab = null;

/**
 * Register callback to be called at each UI update.
 * The callback receives an array of MutationRecords as an argument.
 */
function onUiUpdate(callback) {
    uiUpdateCallbacks.push(callback);
}

/**
 * Register callback to be called soon after UI updates.
 * The callback receives no arguments.
 *
 * This is preferred over `onUiUpdate` if you don't need
 * access to the MutationRecords, as your function will
 * not be called quite as often.
 */
function onAfterUiUpdate(callback) {
    uiAfterUpdateCallbacks.push(callback);
}

/**
 * Register callback to be called when the UI is loaded.
 * The callback receives no arguments.
 */
function onUiLoaded(callback) {
    uiLoadedCallbacks.push(callback);
}

/**
 * Register callback to be called when the UI tab is changed.
 * The callback receives no arguments.
 */
function onUiTabChange(callback) {
    uiTabChangeCallbacks.push(callback);
}

/**
 * Register callback to be called when the options are changed.
 * The callback receives no arguments.
 * @param callback
 */
function onOptionsChanged(callback) {
    optionsChangedCallbacks.push(callback);
}

function executeCallbacks(queue, arg) {
    for (const callback of queue) {
        try {
            callback(arg);
        } catch (e) {
            console.error("error running callback", callback, ":", e);
        }
    }
}

/**
 * Schedule the execution of the callbacks registered with onAfterUiUpdate.
 * The callbacks are executed after a short while, unless another call to this function
 * is made before that time. IOW, the callbacks are executed only once, even
 * when there are multiple mutations observed.
 */
function scheduleAfterUiUpdateCallbacks() {
    clearTimeout(uiAfterUpdateTimeout);
    uiAfterUpdateTimeout = setTimeout(function() {
        executeCallbacks(uiAfterUpdateCallbacks);
    }, 200);
}

var executedOnLoaded = false;

document.addEventListener("DOMContentLoaded", function() {
    var mutationObserver = new MutationObserver(function(m) {
        if (!executedOnLoaded && gradioApp().querySelector('#generate_button')) {
            executedOnLoaded = true;
            executeCallbacks(uiLoadedCallbacks);
        }

        executeCallbacks(uiUpdateCallbacks, m);
        scheduleAfterUiUpdateCallbacks();
        const newTab = get_uiCurrentTab();
        if (newTab && (newTab !== uiCurrentTab)) {
            uiCurrentTab = newTab;
            executeCallbacks(uiTabChangeCallbacks);
        }
    });
    mutationObserver.observe(gradioApp(), {childList: true, subtree: true});
    initStylePreviewOverlay();
});

var onAppend = function(elem, f) {
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
            if (m.addedNodes.length) {
                f(m.addedNodes);
            }
        });
    });
    observer.observe(elem, {childList: true});
}

function addObserverIfDesiredNodeAvailable(querySelector, callback) {
    var elem = document.querySelector(querySelector);
    if (!elem) {
        window.setTimeout(() => addObserverIfDesiredNodeAvailable(querySelector, callback), 1000);
        return;
    }

    onAppend(elem, callback);
}

/**
 * Show reset button on toast "Connection errored out."
 */
addObserverIfDesiredNodeAvailable(".toast-wrap", function(added) {
    added.forEach(function(element) {
         if (element.innerText.includes("Connection errored out.")) {
             window.setTimeout(function() {
                document.getElementById("reset_button").classList.remove("hidden");
                document.getElementById("generate_button").classList.add("hidden");
                document.getElementById("skip_button").classList.add("hidden");
                document.getElementById("stop_button").classList.add("hidden");
            });
         }
    });
});

/**
 * Add a ctrl+enter as a shortcut to start a generation
 */
document.addEventListener('keydown', function(e) {
    const isModifierKey = (e.metaKey || e.ctrlKey || e.altKey);
    const isEnterKey = (e.key == "Enter" || e.keyCode == 13);

    if(isModifierKey && isEnterKey) {
        const generateButton = gradioApp().querySelector('button:not(.hidden)[id=generate_button]');
        if (generateButton) {
            generateButton.click();
            e.preventDefault();
            return;
        }

        const stopButton = gradioApp().querySelector('button:not(.hidden)[id=stop_button]');
        if(stopButton) {
            stopButton.click();
            e.preventDefault();
            return;
        }
    }
});


function playNotification()
{
    gradioApp().querySelector('#audio_notification audio')?.play();
    return;
}


function start_metadata_alarm() {
    // Independent browser-side timer (4 seconds)
    setTimeout(() => {
        const el = document.querySelector('#metadata_commence_signal textarea');
        if (el) {
            // Unique value forces the .change() event every time
            el.value = "COMMENCE_" + Date.now();
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, 4000);
}


// create a delay,
// typically to wait for the UI and the generative process
function delay(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

function init_batchCounter()
// this function triggers modules.ui_util.init_batch_counter()
// which sets batch_counter to 1: flagging that Batch Generate is active
// when the batch series is finished, the batch_counter is reset to 0
{
    const counterButton = document.querySelector("#batch_counter_button");
    if (counterButton)
    {
        counterButton.click();
    }
    return;
}

function clickGenerate()
{
    let isVisible = false
    // check if the generate button is available:
    const genButton = document.querySelector("#generate_button");
    if (genButton)
    {
        // check the generate button's visibility
        // if invisible then image generation is occurring
        isVisible = genButton.checkVisibility
        ({
            checkOpacity: true,
            checkVisibilityCSS: true
        });
        if (isVisible)
        {
            genButton.click();
        }
    } else
    {
        alert("Could not find the Generate button");
    }
    return isVisible
}

async function generateBatch(batch_count, grid_enabled)
{
    // set by Stop button via contextMenus.cancelGenerateForever:
    globalStop = false;
    init_batchCounter()
    while (batch_count > 0)
    {
        if (globalStop == true)
        {
            globalStop = false
            break; // Exit the Batch loop
        }
        const genTrue = clickGenerate();
        if (genTrue === true)
        {
            batch_count--;
        }
        if (grid_enabled === true)
        {
            // delay loop for 6 seconds
            await delay(6000);
        } else
        {
            // delay loop for 4 seconds
            await delay(4000);
        }
    }
}


function initStylePreviewOverlay() {
    // Keep previews inside their labels; never use cached translated label text.
    if (initStylePreviewOverlay.initialized) return;
    const meta = document.querySelector("meta[name='samples-path']");
    if (!meta) return;
    initStylePreviewOverlay.initialized = true;
    const samplesPath = meta.getAttribute('content');

    function refreshStyleThumbnails() {
        gradioApp().querySelectorAll('.style_selections label').forEach(label => {
            const input = label.querySelector('input[type="checkbox"]');
            const span = label.querySelector('span');
            if (!input || !span) return;
            // Gradio's checkbox value is the untranslated style identity.
            // Older builds without a value fall back to the CURRENT visible name.
            let name = input.value && input.value !== 'on' ? input.value : span.textContent.trim();
            if ((!input.value || input.value === 'on') && typeof localization !== 'undefined') {
                name = Object.keys(localization).find(key => localization[key] === name) || name;
            }
            const filename = name.toLowerCase().replaceAll(' ', '_');
            const src = samplesPath.replace('fooocus_v2', filename);
            let img = label.querySelector('img.style-thumbnail');
            if (!img) {
                img = document.createElement('img');
                img.className = 'style-thumbnail';
                img.alt = ''; // The adjacent style name supplies the accessible label.
                img.loading = 'lazy';
                img.decoding = 'async';
                img.width = 80;
                img.height = 80;
                img.addEventListener('error', () => {
                    img.classList.add('style-thumbnail-missing');
                });
                label.insertBefore(img, span);
            }
            if (img.dataset.styleName !== name) {
                img.dataset.styleName = name;
                img.classList.remove('style-thumbnail-missing');
                img.src = src;
            }
        });
    }

    refreshStyleThumbnails();
    // Gradio can reuse labels when sorting, searching, or changing presets.
    onAfterUiUpdate(refreshStyleThumbnails);
}

/**
 * checks that a UI element is not in another hidden element or tab content
 */
function uiElementIsVisible(el) {
    if (el === document) {
        return true;
    }

    const computedStyle = getComputedStyle(el);
    const isVisible = computedStyle.display !== 'none';

    if (!isVisible) return false;
    return uiElementIsVisible(el.parentNode);
}

function uiElementInSight(el) {
    const clRect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const isOnScreen = clRect.bottom > 0 && clRect.top < windowHeight;
    return isOnScreen;
}

function set_theme(theme) {
    var gradioURL = window.location.href;
    if (!gradioURL.includes('?__theme=')) {
        window.location.replace(gradioURL + '?__theme=' + theme);
    }
}

function htmlDecode(input) {
  var doc = new DOMParser().parseFromString(input, "text/html");
  return doc.documentElement.textContent;
}

// Hide cards without removing Gradio's managed checkbox nodes or style definitions.
(function () {
    const storageKey = 'fooocusplus.hiddenStyles.v1';
    let hidden = new Set();
    let storageError = '';
    let rendering = false;
    let lastPanelSignature = null;
    let lastGrid = null;
    const known = new Map();
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!Array.isArray(saved) || saved.some(name => typeof name !== 'string')) {
            throw new Error('Invalid hidden styles list');
        }
        hidden = new Set(saved);
    } catch (error) {
        storageError = 'Could not read saved hidden styles. Changes apply for this page only.';
        console.warn('Hidden styles:', error);
    }

    function persist() {
        try {
            localStorage.setItem(storageKey, JSON.stringify([...hidden].sort()));
            storageError = '';
        } catch (error) {
            storageError = 'Could not save hidden styles. Changes apply for this page only.';
            console.warn('Hidden styles:', error);
        }
    }

    function refreshHiddenStyles() {
        if (rendering) return;
        rendering = true;
        try {
            const app = gradioApp();
            app.querySelectorAll('.style_selections label').forEach(label => {
                const input = label.querySelector('input[type="checkbox"]');
                const span = label.querySelector('span');
                if (!input || !span) return;
                let name = input.value && input.value !== 'on' ? input.value : span.textContent.trim();
                if ((!input.value || input.value === 'on') && typeof localization !== 'undefined') {
                    name = Object.keys(localization).find(key => localization[key] === name) || name;
                }
                const img = label.querySelector('img.style-thumbnail');
                known.set(name, {text: span.textContent.trim(), src: img ? img.getAttribute('src') : ''});
                let button = label.querySelector('.style-hide-button');
                if (!button) {
                    button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'style-hide-button';
                    button.textContent = '×';
                    // Prevent a button click from toggling its enclosing checkbox label.
                    button.addEventListener('click', event => {
                        event.preventDefault();
                        event.stopPropagation();
                        const currentName = button.dataset.styleName;
                        if (input.checked) input.click();
                        hidden.add(currentName);
                        persist();
                        refreshHiddenStyles();
                    });
                    label.appendChild(button);
                }
                button.dataset.styleName = name;
                const title = 'Hide ' + span.textContent.trim();
                if (button.title !== title) {
                    button.title = title;
                    button.setAttribute('aria-label', title);
                }
                const isHidden = hidden.has(name);
                if (label.classList.contains('style-card-hidden') !== isHidden) {
                    label.classList.toggle('style-card-hidden', isHidden);
                }
                // Presets/model changes may select a hidden style: keep it inactive.
                if (isHidden && input.checked) input.click();
            });
            const grid = app.querySelector('#hidden-styles-grid');
            const status = app.querySelector('#hidden-styles-status');
            if (!grid || !status) return;
            const names = [...hidden].sort((a, b) => a.localeCompare(b));
            const signature = JSON.stringify([names.map(name => [name, known.get(name)]), storageError]);
            if (grid === lastGrid && signature === lastPanelSignature) return;
            lastGrid = grid;
            lastPanelSignature = signature;
            status.textContent = storageError || (names.length ? names.length + ' hidden style(s)' : 'No hidden styles. Use × on a style card to hide it.');
            const cards = document.createDocumentFragment();
            names.forEach(name => {
                const info = known.get(name) || {text: name, src: ''};
                const card = document.createElement('div');
                card.className = 'hidden-style-card';
                if (info.src) {
                    const img = document.createElement('img');
                    img.src = info.src;
                    img.alt = '';
                    img.loading = 'lazy';
                    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
                    card.appendChild(img);
                }
                const text = document.createElement('span');
                text.textContent = info.text;
                card.appendChild(text);
                const restore = document.createElement('button');
                restore.type = 'button';
                restore.textContent = 'Restore';
                restore.setAttribute('aria-label', 'Restore ' + info.text);
                restore.addEventListener('click', () => {
                    hidden.delete(name);
                    persist();
                    refreshHiddenStyles();
                    const next = grid.querySelector('button');
                    if (next) next.focus();
                });
                card.appendChild(restore);
                cards.appendChild(card);
            });
            grid.replaceChildren(cards);
        } finally {
            rendering = false;
        }
    }
    onUiLoaded(refreshHiddenStyles);
    onAfterUiUpdate(refreshHiddenStyles);
    window.addEventListener('storage', event => {
        if (event.key !== storageKey && event.key !== null) return;
        try {
            const value = JSON.parse(event.newValue || '[]');
            if (!Array.isArray(value) || value.some(name => typeof name !== 'string')) return;
            hidden = new Set(value);
            refreshHiddenStyles();
        } catch (error) { console.warn('Hidden styles:', error); }
    });
})();
