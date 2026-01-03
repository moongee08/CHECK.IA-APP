document.addEventListener("DOMContentLoaded", () => {

    let aiResponseTimeout = null;
    let chatHistoryLog = []; // Almacena el historial del chat

    // --- AUTH STATE & USER MODEL ---
    // --- AUTH STATE & USER MODEL ---
    let currentUser = {
        isGuest: false,
        name: 'Pepe Álvarez',
        desc: 'Periodista en as.com. Combatiendo los bulo desde hace 15 años',
        avatar: '', // Future use
        auth: true
    };

    // 1. Load from LocalStorage if exists
    const storedUser = localStorage.getItem('checkia_user');
    if (storedUser) {
        try {
            const parsed = JSON.parse(storedUser);
            // Merge to ensure structure (in case of schema updates)
            currentUser = { ...currentUser, ...parsed };
        } catch (e) {
            console.error("Error loading user profile", e);
        }
    }

    // Helper: Update Profile UI (Both View and Edit screens)
    function updateProfileUI() {
        // View Screen
        const viewName = document.getElementById('profile-name');
        const viewDesc = document.getElementById('profile-desc');
        if (viewName) viewName.textContent = currentUser.name;
        if (viewDesc) viewDesc.textContent = currentUser.desc;

        // Edit Screen
        const editNameDisplay = document.querySelector('#edit-name-display .label-like');
        const editNameInput = document.getElementById('input-name-edit');
        const editDescDisplay = document.querySelector('#edit-desc-display p');
        const editDescInput = document.getElementById('input-desc-edit');

        if (editNameDisplay) editNameDisplay.textContent = currentUser.name;
        if (editNameInput) editNameInput.value = currentUser.name;

        if (editDescDisplay) editDescDisplay.textContent = currentUser.desc;
        if (editDescInput) editDescInput.value = currentUser.desc;
    }

    // Call immediately to set initial state
    updateProfileUI();

    // Helper: Save User Profile
    function saveUserProfile(newName, newDesc) {
        currentUser.name = newName;
        currentUser.desc = newDesc;
        localStorage.setItem('checkia_user', JSON.stringify(currentUser));
        updateProfileUI();
        showSuccess("Perfil actualizado correctamente");
    }

    let isScreenReaderEnabled = false; // Para el lector de pantalla


    let currentScreenData = {}; // Estado de la pantalla actual para navegación
    const SCREEN_ORDER = ['chat-screen', 'trends-screen', 'search-screen', 'communities-screen', 'history-screen'];



    // --- CHAT HISTORY STATE ---
    let isChatSelectionMode = false;

    // Almacén de posts
    let forumPosts = [
        { id: 99, title: 'Os dejo el enlace al foro "PALESTINA NEWS"', content: 'Noticias contrastadas y 0 bulos. #FreePalestine #QueNoTeLaCuelen', forum: 'Publicaciones', author: 'Usuario_2375', likes: '7.2k', comments: '89', shares: '2.1k' },
        { id: 1, title: 'Bienvenidos al foro oficial', content: 'Solo noticias verificadas.', forum: 'PALESTINA NEWS', author: 'Usuario_2375', likes: '150', comments: '3', shares: '22' }
    ];
    // Almacén de comentarios
    let allComments = {
        '99': [
            { id: 1001, author: 'Usuario_456', body: '¡Gran aporte! Justo lo que buscaba.', likes: 12, dislikes: 1 },
            { id: 1002, author: 'Usuario_789', body: 'No estoy de acuerdo con el enlace, me parece sesgado.', likes: 2, dislikes: 5 }
        ],
        '1': [
            { id: 1003, author: 'Maria Martin', body: 'Gracias por crear este espacio.', likes: 5, dislikes: 0 }
        ]
    };

    // --- SEARCH DATA MODEL (Refactored for Smart Routing) ---
    const searchableData = [
        { id: 'news-1', title: "Resultados LaLiga", type: 'news', context: 'Deportes' },
        { id: 'news-2', title: "Noticias Madrid", type: 'news', context: 'Local' },
        { id: 'news-3', title: "Remedios dolor de cabeza", type: 'news', context: 'Salud' },
        { id: 'news-4', title: "Ventajas de usar creatina", type: 'news', context: 'Salud' },
        { id: 'forum-1', title: "Foro: PALESTINA NEWS", type: 'forum', context: 'Comunidad' },
        { id: 'forum-2', title: "Foro: NORMATIVAS DE TRÁFICO", type: 'forum', context: 'Comunidad' },
        { id: 'user-1', title: "Usuario: Pepe Álvarez", type: 'user', context: 'Perfil' },
        { id: 'user-2', title: "Usuario: Usuario_2375", type: 'user', context: 'Perfil' }
    ];

    // --- SEARCH HISTORY STATE ---
    let searchHistory = [];
    const storedHistory = localStorage.getItem('checkia_search_history');
    if (storedHistory) {
        try { searchHistory = JSON.parse(storedHistory); } catch (e) { console.error(e); }
    }

    function saveSearchHistory() {
        localStorage.setItem('checkia_search_history', JSON.stringify(searchHistory));
        // Update both lists if they exist
        renderSearchHistoryDropdown(); // In Search Screen
        renderFullHistoryScreen();     // In History Screen
    }

    function addToHistory(term) {
        if (!term) return;
        // Remove valid duplicates (case insensitive)
        searchHistory = searchHistory.filter(item => item.toLowerCase() !== term.toLowerCase());
        // Add to front
        searchHistory.unshift(term);
        // Limit to 10
        if (searchHistory.length > 10) searchHistory.pop();
        saveSearchHistory();
    }

    // --- 1. PLANTILLAS (Templates) ---
    const headerTemplate = document.getElementById('header-template').innerHTML;
    const navbarTemplate = document.getElementById('navbar-template').innerHTML;
    const mainScreens = document.querySelectorAll('.main-screen');

    mainScreens.forEach(screen => {
        screen.insertAdjacentHTML('afterbegin', headerTemplate);
        screen.insertAdjacentHTML('beforeend', navbarTemplate);
    });

    // --- 2. POPUPS Y DIÁLOGOS ---
    const popups = document.querySelectorAll('.popup-menu, .popup-dialog');
    function hidePopups() {
        popups.forEach(p => p.classList.remove('active'));
    }

    function showPopup(popupId, triggerElement = null) {
        hidePopups();
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.classList.add('active');

            if (triggerElement) {

                const container = document.querySelector('.mobile-container');
                const containerRect = container.getBoundingClientRect();
                const triggerRect = triggerElement.getBoundingClientRect();

                // 1. Coordenadas relativas al CONTENEDOR
                let left = triggerRect.left - containerRect.left;

                // Ancho estimado
                const popupWidth = 200;

                // 2. Ajuste Horizontal
                if (left + popupWidth > containerRect.width) {
                    left = containerRect.width - popupWidth - 10;
                }
                if (left < 10) left = 10;

                // Header alignment override
                if (triggerElement.closest('.header-icons')) {
                    left = (triggerRect.right - containerRect.left) - popupWidth;
                    if (left < 10) left = 10;
                }

                // 3. Ajuste Vertical (Arriba/Abajo)
                const topRelativeToContainer = triggerRect.bottom - containerRect.top;
                const spaceBelow = containerRect.height - topRelativeToContainer;

                // Forzar ARRIBA si hay poco espacio o es chat attach
                if (spaceBelow < 250 || triggerElement.id === 'chat-attach-btn') {
                    // bottom = (height - topRelativeToTriggerTop)
                    const triggerTopRelative = triggerRect.top - containerRect.top;
                    popup.style.top = 'auto';
                    popup.style.bottom = `${containerRect.height - triggerTopRelative + 5}px`;
                } else {
                    popup.style.top = `${topRelativeToContainer + 5}px`;
                    popup.style.bottom = 'auto';
                }

                // 4. Estilos ABSOLUTOS
                popup.style.position = 'absolute';
                popup.style.left = `${left}px`;
                popup.style.width = 'auto';
                popup.style.minWidth = '180px';

            } else {
                popup.style.top = '';
                popup.style.bottom = '';
                popup.style.left = '';
                popup.style.position = '';
            }
        }
    }

    // --- SEARCH FILTERS LOGIC (MOCK) ---
    const filterSelects = document.querySelectorAll('.filter-select');
    filterSelects.forEach(select => {
        select.addEventListener('change', () => {
            const val = select.value;
            // Mock feedback
            showSuccess(`Filtro aplicado: ${select.options[select.selectedIndex].text}`);
            // In a real app, this would trigger a re-fetch of search results
        });
    });

    // --- REPORT FORM HANDLER ---
    const reportForm = document.getElementById('report-form');
    if (reportForm) {
        reportForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Simulate network request
            showSuccess("Reporte enviado correctamente. Gracias por tu feedback.");
            reportForm.reset();
            setTimeout(() => {
                showScreen('settings-screen');
            }, 1500);
        });
    }

    // --- CONTACT SUPPORT FORM HANDLER ---
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('contact-email').value;
            // Simulate sending
            showSuccess(`Consulta enviada. Te responderemos a ${email} pronto.`);
            contactForm.reset();
            setTimeout(() => {
                showScreen('help-screen');
            }, 2000);
        });
    }

    // --- GENERIC CONFIRMATION ---
    let pendingConfirmAction = null;

    function showConfirmation(message, onConfirm, isDestructive = false) {
        document.getElementById('generic-confirm-message').innerText = message;
        pendingConfirmAction = onConfirm;

        const confirmBtn = document.getElementById('generic-confirm-btn');
        if (isDestructive) {
            confirmBtn.classList.add('btn-destructive');
        } else {
            confirmBtn.classList.remove('btn-destructive');
        }

        showPopup('generic-confirm-popup');
    }

    document.getElementById('generic-confirm-btn').addEventListener('click', () => {
        if (pendingConfirmAction) pendingConfirmAction();
        hidePopups();
        pendingConfirmAction = null;
    });

    document.getElementById('generic-cancel-btn').addEventListener('click', () => {
        hidePopups();
        pendingConfirmAction = null;
    });

    // --- GENERIC NOTIFICATION POPUP (Success/Error) ---
    function showNotification(message, type = 'success') {
        const popup = document.getElementById('generic-success-popup');
        const msgEl = document.getElementById('generic-success-message');
        // Find icon container - assuming it's the first div
        const iconContainer = popup.querySelector('.popup-dialog-content div');

        msgEl.innerText = message;

        if (type === 'error') {
            if (iconContainer) {
                iconContainer.style.color = 'var(--color-danger)';
                iconContainer.innerHTML = '<i class="ph ph-warning-circle"></i>';
            }
        } else {
            if (iconContainer) {
                iconContainer.style.color = 'var(--color-success)';
                iconContainer.innerHTML = '<i class="ph ph-check-circle"></i>';
            }
        }
        showPopup('generic-success-popup');
    }

    function showSuccess(msg) { showNotification(msg, 'success'); }
    function showError(msg) { showNotification(msg, 'error'); }

    document.getElementById('generic-success-btn').addEventListener('click', () => {
        hidePopups();
    });

    document.querySelector('.mobile-container').addEventListener('click', (e) => {
        if (!e.target.closest('.popup-menu') && !e.target.closest('.header-icons button') && !e.target.closest('.dropdown-menu') && !e.target.closest('#chat-attach-btn') && !e.target.closest('.show-popup') && !e.target.closest('.post-card.nav-link') && !e.target.closest('.popup-dialog')) {
            hidePopups();
        }
    });

    // --- 3. FUNCIÓN PRINCIPAL DE NAVEGACIÓN ---
    // --- 3. FUNCIÓN PRINCIPAL DE NAVEGACIÓN ---
    function showScreen(screenId, data = {}, isBack = false) {
        hidePopups();

        const currentScreen = document.querySelector('.screen.active');
        const nextScreen = document.getElementById(screenId);

        if (!nextScreen) {
            console.error("No se encontró la pantalla:", screenId);
            return;
        }

        if (currentScreen && currentScreen.id === screenId) return;

        // Determinar direccion de la transicion SOLO si ambas son Main Screens
        let transitionDir = 'right';
        let shouldAnimate = false;


        const isCurrentMain = SCREEN_ORDER.includes(currentScreen ? currentScreen.id : '');
        const isNextMain = SCREEN_ORDER.includes(screenId);

        // --- PRE-TRANSICION: Guardar estado para volver ---
        if (screenId === 'comments-screen') {
            const backBtn = nextScreen.querySelector('.btn-back');
            if (backBtn && currentScreen) {
                backBtn.dataset.target = currentScreen.id;
                // Guardamos los datos actuales para restaurarlos al volver
                backBtn.dataset.restoreData = JSON.stringify(currentScreenData);
            }
        }

        if (isCurrentMain && isNextMain) {
            shouldAnimate = true;
            const currentIndex = SCREEN_ORDER.indexOf(currentScreen.id);
            const nextIndex = SCREEN_ORDER.indexOf(screenId);
            if (nextIndex < currentIndex) {
                transitionDir = 'left';
            }
        }

        // Animación de Salida (Current)
        if (currentScreen) {
            if (shouldAnimate) {
                const exitClass = (transitionDir === 'left') ? 'screen-exit-back' : 'screen-exit';
                currentScreen.classList.add(exitClass);
                setTimeout(() => {
                    currentScreen.classList.remove('active', 'screen-exit', 'screen-exit-back');
                }, 290);
            } else {
                currentScreen.classList.remove('active'); // Salida inmediata
            }
        }

        // Animación de Entrada (Next)
        if (shouldAnimate) {
            const enterClass = (transitionDir === 'left') ? 'screen-enter-back' : 'screen-enter';
            nextScreen.classList.add('active', enterClass);
            setTimeout(() => {
                nextScreen.classList.remove('screen-enter', 'screen-enter-back');
            }, 300);
        } else {
            nextScreen.classList.add('active'); // Entrada inmediata
        }


        // --- Lógica Específica de Pantalla ---

        if (screenId === 'forum-posts-screen' && data.title) {
            document.getElementById('forum-title').innerText = data.title;
            const contentArea = document.getElementById('forum-posts-content');
            contentArea.innerHTML = '';

            const posts = forumPosts.filter(p => p.forum === data.title);
            if (posts.length > 0) {
                posts.forEach(post => {
                    contentArea.innerHTML += createPostHTML(post);
                });
            } else {
                contentArea.innerHTML = '<p style="padding: 20px; opacity: 0.7; text-align: center;">No hay publicaciones en este foro todavía.</p>';
            }
        }

        if (screenId === 'comments-screen' && data.postId) {
            const post = forumPosts.find(p => p.id == data.postId);
            if (post) {
                document.getElementById('comments-original-post').innerHTML = createPostHTML(post, false); // false = no navegable
                document.getElementById('comment-form').dataset.postId = post.id;
                renderComments(post.id);
            }
        }

        if (screenId === 'chat-history-screen') {
            renderChatHistory();
        }

        if (screenId === 'trends-screen') {
            applyFiabilityColors(document.querySelectorAll('.trends-fiability'));
        }

        // --- NEW: Renderizar posts de comunidad dinamicamente ---
        if (screenId === 'communities-posts-screen') {
            const container = document.getElementById('all-posts-container');
            if (container) {
                container.innerHTML = '';
                // Renderizar TODOS los posts disponibles en el array
                forumPosts.forEach(post => {
                    container.innerHTML += createPostHTML(post);
                });
            }
        }

        // --- UPDATE PROFILE UI ON ENTER ---
        if (screenId === 'edit-profile-screen' || screenId === 'profile-screen') {
            updateProfileUI();
        }

        // --- Lógica de la Barra de Navegación Activa ---
        if (nextScreen.classList.contains('main-screen')) {
            // Handle Main Nav Bar
            const navBar = nextScreen.querySelector('.nav-bar');
            if (navBar) {
                // reset active states in clones if any, but properly we select from document if unique
                document.querySelectorAll('.nav-bar .nav-btn').forEach(btn => btn.classList.remove('active'));

                let activeId = screenId;

                if (screenId.startsWith('communities-') || screenId.startsWith('forum-') || screenId === 'comments-screen' || screenId.startsWith('private-chat-') || screenId === 'other-profile-screen' || screenId === 'new-post-screen' || screenId === 'accessibility-screen') {
                    activeId = 'communities-screen';
                }
                if (screenId === 'history-select-screen') {
                    activeId = 'history-screen';
                }

                const activeBtn = nextScreen.querySelector(`.nav-bar .nav-btn[data-target="${activeId}"]`);
                if (activeBtn) {
                    activeBtn.classList.add('active');
                }
            }

            // Handle Top Tab Bar (Community)
            const topBar = nextScreen.querySelector('.top-tab-bar');
            if (topBar) {
                topBar.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                const activeTab = topBar.querySelector(`.tab-btn[data-target="${screenId}"]`);
                if (activeTab) {
                    activeTab.classList.add('active');
                }
            }
        }

        // Actualizar datos globales
        currentScreenData = data;
    }

    // --- 4. EVENT LISTENERS DE NAVEGACIÓN ---

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        currentUser = {
            isGuest: false,
            name: 'UsuarioDemo',
            desc: 'Usuario registado',
            auth: true
        };
        showScreen('chat-screen');
    });

    // Guest Login Handler
    document.getElementById('guest-login-btn').addEventListener('click', (e) => {
        e.preventDefault();
        currentUser = {
            isGuest: true,
            name: 'Invitado',
            desc: '',
            auth: false
        };
        alert("Entrando en modo invitado. Algunas funciones estarán limitadas.");
        showScreen('chat-screen');
    });

    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        currentUser = {
            isGuest: false,
            name: document.getElementById('reg-name').value || 'Nuevo Usuario',
            desc: 'Nuevo en Check.ia',
            auth: true
        };
        showScreen('chat-screen');
    });
    document.getElementById('reset-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        if (email === 'reset@check.ia') { // Reset login form
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
            showSuccess('Formulario de login reseteado.');
            setTimeout(() => {
                showScreen('login-screen', {}, true);
            }, 1500);
        } else {
            showSuccess('Se ha enviado un correo de recuperación a: ' + email);
            setTimeout(() => {
                showScreen('login-screen', {}, true);
            }, 1500);
        }
    });
    // document.getElementById('confirm-logout') Removed - handled by generic flow

    // Navegación general (botones y enlaces)
    document.addEventListener('click', (e) => {
        const navLink = e.target.closest('.nav-link');
        const navBtn = e.target.closest('.nav-btn');
        const tabBtn = e.target.closest('.tab-btn');
        const btnBack = e.target.closest('.btn-back');
        const logoBtn = e.target.closest('.logo-small');
        const inlineTrigger = e.target.closest('.dropdown-trigger-inline');

        // Inline Dropdown Toggle
        if (inlineTrigger) {
            const container = inlineTrigger.closest('.inline-dropdown-container');
            const list = container.querySelector('.inline-dropdown-list');
            list.classList.toggle('active');
            // Close others? Optional.
            return;
        }

        let targetScreen = null;
        let data = {};
        let isBack = false;

        if (navLink) {
            if (e.target.closest('.btn-like, .btn-follow, .btn-share, .post-header strong')) {
                return;
            }

            // Auto-close inline dropdown if clicked inside
            const parentList = navLink.closest('.inline-dropdown-list');
            if (parentList) {
                parentList.classList.remove('active');
            }

            e.preventDefault();
            if (navLink.id === 'confirm-logout') return;
            targetScreen = navLink.dataset.target;

            // --- RESTRICTION CHECK FOR GUESTS ---
            // Prevent access to specific screens for guests if needed
            // The user said: "Access to settings, help is allowed". 
            // We only block "New Post" screen for now via navigation, or other specific actions.
            if (currentUser.isGuest) {
                if (targetScreen === 'new-post-screen' || targetScreen === 'edit-profile-screen' || targetScreen.startsWith('private-chat-')) {
                    alert("Esta función requiere iniciar sesión.");
                    return;
                }
                // Redirect Profile Screen in Nav Bar to Guest Menu logic? 
                // No, the user said "when clicking profile icon". 
                // But logic for "My Profile" in other places might need check.
                if (targetScreen === 'profile-screen' && !navLink.closest('.popup-menu')) {
                    // If clicking "Profile" from a menu that isn't the guest popup itself
                    // But wait, guests allow viewing profiles of OTHERS? 
                    // Usually yes. But viewing OWN profile? User said "profile icon -> login/register".
                    // We will handle the Header Profile Icon specifically.
                }
            }

            if (targetScreen === 'forum-posts-screen' && navLink.dataset.title) {
                data.title = navLink.dataset.title;
            }
            if (targetScreen === 'comments-screen' && navLink.dataset.postId) {
                data.postId = navLink.dataset.postId;
            }
        }
        else if (navBtn) { targetScreen = navBtn.dataset.target; }
        else if (tabBtn) { targetScreen = tabBtn.dataset.target; }
        else if (logoBtn && !logoBtn.closest('#help-screen')) {
            // Logo in header goes to Home (chat-screen)
            // Exception: Help screen has a textual logo that is not clickable/home link? 
            // User requirement: "Al hacer clic en el logo/texto CHECK.IA... redirigir a Inicio"
            // The Help screen title is literally "AYUDA" now in .logo-small, so we might want to exclude it if it's not "CHECK.IA"
            if (logoBtn.innerText.includes('CHECK.IA')) {
                targetScreen = 'chat-screen';
            }
        }
        else if (btnBack) {
            targetScreen = btnBack.dataset.target;
            isBack = true;
            if (btnBack.dataset.restoreData) {
                try {
                    data = JSON.parse(btnBack.dataset.restoreData);
                } catch (err) {
                    console.error("Error parsing restore data", err);
                }
            }
        }

        if (targetScreen) { showScreen(targetScreen, data, isBack); }
    });

    // Lógica para Toggles (Nuevo Fase 4)
    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.toggle-switch');
        if (toggleBtn) {
            const currentState = toggleBtn.getAttribute('aria-checked') === 'true';
            const newState = !currentState;
            toggleBtn.setAttribute('aria-checked', newState);

            // Lógica específica para Lector de Pantalla
            if (toggleBtn.id === 'screen-reader-toggle') {
                isScreenReaderEnabled = newState;
                alert(isScreenReaderEnabled ? "Lector de pantalla simulado: ACTIVADO" : "Lector de pantalla simulado: DESACTIVADO");
            }
        }
    });

    // Abrir Popups
    document.addEventListener('click', (e) => {
        const showPopupBtn = e.target.closest('.show-popup');
        if (showPopupBtn) {
            e.preventDefault();
            showPopup(showPopupBtn.dataset.target);
            return;
        }

        const userBtn = e.target.closest('[data-target="profile-trigger"]') || e.target.closest('.header-user-btn'); // Support both
        const optionsBtn = e.target.closest('.header-options-btn');
        const langBtn = e.target.closest('.header-lang-btn');
        const communityMenu = e.target.closest('.dropdown-menu');
        const chatAttachBtn = e.target.closest('.chat-attach');

        let popupId = null;
        let triggerElement = null;

        if (userBtn) {
            triggerElement = userBtn;
            if (currentUser && currentUser.isGuest) {
                popupId = 'guest-popup';
            } else {
                popupId = 'user-popup';
            }
        }
        else if (optionsBtn) { popupId = 'options-popup'; triggerElement = optionsBtn; }
        else if (langBtn) { popupId = 'language-popup'; triggerElement = langBtn; }
        else if (communityMenu) { popupId = 'communities-popup'; triggerElement = communityMenu; }
        else if (chatAttachBtn) { popupId = 'chat-attach-popup'; triggerElement = chatAttachBtn; }

        if (popupId) {
            e.preventDefault();
            // Force hide any other open popups first
            hidePopups();
            // Small delay to ensure clean state or direct show
            setTimeout(() => {
                showPopup(popupId, triggerElement);
            }, 10);
        }
    });

    // Confirmation Triggers
    document.addEventListener('click', (e) => {
        if (e.target.closest('.confirm-trigger')) {
            const btn = e.target.closest('.confirm-trigger');
            const action = btn.dataset.action;

            if (action === 'logout') {
                showConfirmation("¿Seguro que desea cerrar sesión?", () => {
                    document.getElementById('login-form').reset();
                    currentUser = null;
                    showScreen('login-screen', {}, true);
                }, true);
            } else if (action === 'delete-selected-history') {
                showConfirmation("¿Seguro que quiere borrar los elementos seleccionados?", () => {
                    const checkboxes = document.querySelectorAll('.list-history-select input[type="checkbox"]:checked');
                    if (checkboxes.length > 0) {
                        const indicesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index)).sort((a, b) => b - a);
                        indicesToDelete.forEach(index => {
                            searchHistory.splice(index, 1);
                        });
                        saveSearchHistory();
                        showSuccess(`${checkboxes.length} elementos borrados.`);
                    } else {
                        showError("No has seleccionado nada.");
                    }
                    showScreen('history-screen');
                }, true);
            } else if (action === 'delete-all-history') {
                showConfirmation("¿Seguro que desea borrar todo el historial?", () => {
                    searchHistory = [];
                    saveSearchHistory();
                    showSuccess("Historial borrado por completo.");
                }, true);
            } else if (action === 'delete-all-chat-history') {
                showConfirmation("¿Seguro que desea borrar todo el historial del chat?", () => {
                    chatHistoryLog = [];
                    renderChatHistory();
                    showSuccess("Historial de chat borrado.");
                }, true);
            } else if (action === 'delete-selected-chat-history') {
                showConfirmation("¿Seguro que desea borrar los chats seleccionados?", () => {
                    const checkboxes = document.querySelectorAll('#chat-history-list-container input[type="checkbox"]:checked');
                    if (checkboxes.length > 0) {
                        const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index)).sort((a, b) => b - a);
                        indices.forEach(idx => {
                            chatHistoryLog.splice(idx, 1);
                        });
                        showSuccess(`${indices.length} chats borrados.`);
                    } else {
                        showError("No has seleccionado nada.");
                    }
                    renderChatHistory();
                }, true);
            }
        }
    });

    // --- PERFIL DE USUARIO: EDICIÓN (SIMPLIFICADO) ---
    // Ya no hay toggles, los inputs están siempre visibles en la pantalla de edición.
    document.addEventListener('click', (e) => {
        // Save Profile
        if (e.target.closest('#save-profile-btn')) {
            const newNameInput = document.getElementById('input-name-edit');
            const newDescInput = document.getElementById('input-desc-edit');

            if (newNameInput && newDescInput) {
                const newName = newNameInput.value.trim();
                const newDesc = newDescInput.value.trim();

                if (!newName) {
                    showError("El nombre no puede estar vacío");
                    return;
                }

                saveUserProfile(newName, newDesc);

                // Go back immediately
                setTimeout(() => {
                    showScreen('profile-screen', {}, true);
                }, 500);
            }
        }
    });

    // --- 5. SIMULACIÓN DE FUNCIONALIDAD ---

    // a) Tema Claro/Oscuro
    document.getElementById('theme-toggle-btn').addEventListener('click', (e) => {
        const body = document.body;
        const currentTheme = body.dataset.theme;
        const newTheme = (currentTheme === 'light') ? 'dark' : 'light';
        body.dataset.theme = newTheme;
        e.target.innerHTML = (newTheme === 'light') ? '<i class="ph ph-moon"></i> Tema Oscuro' : '<i class="ph ph-sun"></i> Tema Claro';
        hidePopups();
    });

    // b) Tamaño de Letra
    document.getElementById('font-size-slider').addEventListener('input', (e) => {
        const value = e.target.value;
        const sizes = ['small', 'medium', 'large'];
        document.body.dataset.fontSize = sizes[value];
    });

    // c) Simulación de Chat IA
    document.getElementById('chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input-text');
        const chatArea = document.getElementById('chat-content-area');
        const message = input.value.trim();

        if (!message) return;

        chatArea.innerHTML += `<div class="chat-bubble sent">${message}</div>`;
        input.value = '';

        const loadingBubble = document.createElement('div');
        loadingBubble.className = 'chat-bubble received ai-loading';
        loadingBubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        chatArea.appendChild(loadingBubble);
        chatArea.scrollTop = chatArea.scrollHeight;

        const sendBtn = document.getElementById('chat-send-btn');
        const stopBtn = document.getElementById('chat-stop-btn');
        sendBtn.style.display = 'none';
        stopBtn.style.display = 'block';

        aiResponseTimeout = setTimeout(() => {
            loadingBubble.remove();
            const fiabilidad = Math.floor(Math.random() * 100) + 1;

            chatHistoryLog.push({ query: message, fiabilidad: fiabilidad, date: new Date() });

            chatArea.innerHTML += `
                <div class="chat-bubble received ai-response">
                    <p>Analizando...</p><p>Fiabilidad aproximada:</p>
                    <strong>${fiabilidad}%</strong>
                </div>
            `;
            chatArea.scrollTop = chatArea.scrollHeight;

            sendBtn.style.display = 'block';
            stopBtn.style.display = 'none';
        }, 2000);
    });

    document.getElementById('chat-stop-btn').addEventListener('click', () => {
        if (aiResponseTimeout) {
            clearTimeout(aiResponseTimeout);
            aiResponseTimeout = null;
        }

        document.getElementById('chat-send-btn').style.display = 'block';
        document.getElementById('chat-stop-btn').style.display = 'none';

        const loadingBubble = document.querySelector('.ai-loading');
        if (loadingBubble) {
            loadingBubble.remove();
        }

        const chatArea = document.getElementById('chat-content-area');
        chatArea.innerHTML += `<div class="chat-bubble received ai-response">Generación cancelada.</div>`;
        chatArea.scrollTop = chatArea.scrollHeight;
    });

    // Lógica del botón de Micrófono
    document.addEventListener('click', (e) => {
        const micBtn = e.target.closest('.chat-mic');
        if (micBtn) {
            micBtn.classList.toggle('listening');

            const form = micBtn.closest('form, .form-layout, .textarea-container');
            if (!form) return;

            const inputField = form.querySelector('input[type="text"], textarea');
            if (!inputField) return;

            if (micBtn.classList.contains('listening')) {
                alert("Simulación de entrada de audio... (grabando)");
                inputField.value += " (texto simulado por voz) ";
                setTimeout(() => {
                    micBtn.classList.remove('listening');
                }, 2000);
            }
        }
    });


    // d) Chats privados
    document.addEventListener('submit', (e) => {
        if (e.target.id && e.target.id.startsWith('private-chat-form-')) {
            e.preventDefault();
            const input = e.target.querySelector('input[type="text"]');
            const chatArea = e.target.previousElementSibling;
            const message = input.value.trim();

            if (!message) return;

            chatArea.innerHTML += `<div class="chat-bubble sent">${message}</div>`;
            input.value = '';
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    });

    // e) Interacciones (Likes, Follows, Thumbs)
    document.addEventListener('click', (e) => {
        // Lógica de "Like" para Publicaciones
        if (e.target.classList.contains('btn-like')) {
            e.stopPropagation();
            if (currentUser.isGuest) {
                showError("Debes iniciar sesión para dar Me gusta.");
                return;
            }
            const postId = e.target.dataset.postId;
            const post = forumPosts.find(p => p.id == postId);
            if (!post) return;

            const isLiked = e.target.classList.toggle('liked');

            // Actualiza el contador
            let likesStr = post.likes.toString();
            if (likesStr.includes('k')) {
                likesStr = isLiked ? post.likes.split('+')[0] + "+1" : post.likes.split('+')[0];
            } else {
                let likesNum = parseInt(likesStr) || 0;
                likesNum = isLiked ? likesNum + 1 : Math.max(0, likesNum - 1);
                post.likes = likesNum;
                likesStr = likesNum.toString();
            }
            e.target.innerHTML = `<i class="ph ph-thumbs-up"></i> ${likesStr}`;
            e.target.setAttribute('aria-label', `${likesStr} Me gusta`);
            return;
        }

        if (e.target.classList.contains('btn-follow')) {
            e.stopPropagation();
            if (currentUser.isGuest) {
                showError("Debes iniciar sesión para seguir usuarios.");
                return;
            }
            e.target.classList.toggle('followed');
            e.target.innerText = e.target.classList.contains('followed') ? 'Siguiendo' : 'Seguir';
            return;
        }

        // Lógica de "Like" para Comentarios
        if (e.target.classList.contains('btn-thumb-up')) {
            e.stopPropagation();
            if (currentUser.isGuest) {
                showError("Debes iniciar sesión para votar.");
                return;
            }
            const postId = e.target.closest('.content').querySelector('#comment-form').dataset.postId;
            const commentId = e.target.closest('.comment-card').dataset.commentId;
            const comment = allComments[postId].find(c => c.id == commentId);
            if (!comment) return;

            const isLiked = e.target.classList.toggle('active');

            const dislikeBtn = e.target.nextElementSibling;
            if (isLiked && dislikeBtn.classList.contains('active')) {
                dislikeBtn.classList.remove('active');
                comment.dislikes = Math.max(0, comment.dislikes - 1);
                dislikeBtn.innerHTML = `<i class="ph ph-thumbs-down"></i> ${comment.dislikes}`;
                dislikeBtn.setAttribute('aria-label', `${comment.dislikes} No me gusta`);
            }

            comment.likes = isLiked ? comment.likes + 1 : Math.max(0, comment.likes - 1);
            e.target.innerHTML = `<i class="ph ph-thumbs-up"></i> ${comment.likes}`;
            e.target.setAttribute('aria-label', `${comment.likes} Me gusta`);
            return;
        }

        // Lógica de "Dislike" para Comentarios
        if (e.target.classList.contains('btn-thumb-down')) {
            e.stopPropagation();
            if (currentUser.isGuest) {
                showError("Debes iniciar sesión para votar.");
                return;
            }
            const postId = e.target.closest('.content').querySelector('#comment-form').dataset.postId;
            const commentId = e.target.closest('.comment-card').dataset.commentId;
            const comment = allComments[postId].find(c => c.id == commentId);
            if (!comment) return;

            const isDisliked = e.target.classList.toggle('active');

            const likeBtn = e.target.previousElementSibling;
            if (isDisliked && likeBtn.classList.contains('active')) {
                likeBtn.classList.remove('active');
                comment.likes = Math.max(0, comment.likes - 1);
                likeBtn.innerHTML = `<i class="ph ph-thumbs-up"></i> ${comment.likes}`;
                likeBtn.setAttribute('aria-label', `${comment.likes} Me gusta`);
            }

            comment.dislikes = isDisliked ? comment.dislikes + 1 : Math.max(0, comment.dislikes - 1);
            e.target.innerHTML = `<i class="ph ph-thumbs-down"></i> ${comment.dislikes}`;
            e.target.setAttribute('aria-label', `${comment.dislikes} No me gusta`);
            return;
        }
    });


    // f) Historial de Búsqueda
    // Logic moved to generic confirm trigger handler

    // g) Ojo de Contraseña
    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.password-toggle');
        if (toggleBtn) {
            const input = toggleBtn.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                toggleBtn.innerHTML = '<i class="ph ph-eye-slash"></i>';
                toggleBtn.setAttribute('aria-label', 'Ocultar contraseña');
            } else {
                input.type = 'password';
                toggleBtn.innerHTML = '<i class="ph ph-eye"></i>';
                toggleBtn.setAttribute('aria-label', 'Mostrar contraseña');
            }
        }
    });

    // h) Lógica de Compartir
    document.addEventListener('click', async (e) => {
        const shareBtn = e.target.closest('.btn-share');
        if (shareBtn) {
            e.stopPropagation();
            const title = shareBtn.dataset.shareTitle || "Mira esta publicación de Check.ia";
            const shareData = {
                title: title,
                text: `Echa un vistazo a esto: "${title}"`,
                url: window.location.href,
            };

            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                } else {
                    navigator.clipboard.writeText(shareData.url);
                    showSuccess("¡Enlace copiado al portapapeles! (Simulado)");
                }
            } catch (err) {
                showError("Error al compartir. (Simulado)");
            }
        }
    });


    // i) Renderizado y colores de Fiabilidad
    function getFiabilityClass(score) {
        if (score < 20) return 'low';
        if (score < 60) return 'medium';
        return 'high';
    }

    function applyFiabilityColors(elements) {
        elements.forEach(card => {
            const score = parseInt(card.dataset.score, 10);
            const scoreEl = card.querySelector('.fiability-score');
            const labelEl = card.querySelector('.fiability-label');
            const fiabilityClass = getFiabilityClass(score);

            if (scoreEl) scoreEl.className = `fiability-score ${fiabilityClass}`;
            if (labelEl) {
                labelEl.className = `fiability-label ${fiabilityClass}`;
                labelEl.innerText = fiabilityClass === 'low' ? 'Falso' : (fiabilityClass === 'medium' ? 'Dudoso' : 'Fiable');
            }
        });
    }

    // j) Historial de Chat (Renderizado y Borrado)
    function renderChatHistory() {
        const container = document.getElementById('chat-history-list-container');
        if (chatHistoryLog.length === 0) {
            container.innerHTML = '<li style="opacity: 0.7; text-align: center;">No hay historial de chat.</li>';
            return;
        }

        container.innerHTML = '';
        chatHistoryLog.forEach((item, index) => {
            const fiabilityClass = getFiabilityClass(item.fiabilidad);
            const li = document.createElement('li');
            li.className = isChatSelectionMode ? '' : 'nav-link';
            if (!isChatSelectionMode) li.dataset.target = 'chat-screen';

            // Si es Seleccion, no es navegable, es toggleable
            if (isChatSelectionMode) {
                li.innerHTML = `
                    <label class="checkbox-container">
                        <input type="checkbox" data-index="${index}">
                        <div class="chat-history-item" style="width: 100%;">
                            <strong>${item.query}</strong>
                            <small class="${fiabilityClass}">Fiabilidad: ${item.fiabilidad}%</small>
                        </div>
                    </label>
                `;
            } else {
                li.setAttribute('aria-label', `Ver consulta: ${item.query}. Fiabilidad: ${item.fiabilidad} por ciento.`);
                li.tabIndex = 0;
                li.innerHTML = `
                    <div class="chat-history-item">
                        <strong>${item.query}</strong>
                        <small class="${fiabilityClass}">Fiabilidad: ${item.fiabilidad}% (${fiabilityClass === 'low' ? 'Falso' : (fiabilityClass === 'medium' ? 'Dudoso' : 'Fiable')})</small>
                    </div>
                `;
            }
            container.appendChild(li);
        });
    }

    document.getElementById('chat-history-select-btn').addEventListener('click', (e) => {
        isChatSelectionMode = !isChatSelectionMode;
        e.target.innerText = isChatSelectionMode ? 'Cancelar' : 'Seleccionar';

        const btnDeleteSel = document.getElementById('btn-delete-chat-sel');
        const btnDeleteAll = document.getElementById('btn-delete-chat-all');

        if (isChatSelectionMode) {
            btnDeleteSel.style.display = 'block'; // Show Delete Selected
            btnDeleteAll.style.display = 'none';  // Hide Delete All? Or keep? Requirement says "Mantener opcion borrar todo". 
            // Better to keep Borrar Todo available or just swap?
            // "Eliminar el botón de basura individual... Implementar un Modo Selección... Mantener la opción de Borrar Todo".
            // Typically "Delete Selected" appears instead or alongside. I'll swap for clarity in limited space.
            btnDeleteAll.style.display = 'none';
        } else {
            btnDeleteSel.style.display = 'none';
            btnDeleteAll.style.display = 'block';
        }
        renderChatHistory();
    });

    // Logic moved to generic confirm trigger handler
    // TODO: Lógica para 'chat-history-select' (seleccionar y borrar)

    // k) Funcionalidad de Búsqueda
    // k) Funcionalidad de Búsqueda Inteligente (History + Smart Routing)

    const searchBar = document.getElementById('search-bar');
    const searchResultsList = document.getElementById('search-results-list');

    // 1. Render History Dropdown (cuando input está vacío/focus)
    function renderSearchHistoryDropdown() {
        if (!searchBar.value.trim() && searchHistory.length > 0) {
            searchResultsList.innerHTML = `<li class="list-header"><small>Historial Reciente</small></li>`;
            searchResultsList.innerHTML += searchHistory.map(term => `
                <li class="search-item history-item" tabindex="0" data-term="${term}">
                    <i class="ph ph-clock-counter-clockwise"></i> ${term}
                </li>
            `).join('');
        } else if (!searchBar.value.trim()) {
            searchResultsList.innerHTML = ''; // Limpiar si no hay historial
        }
    }

    // 2. Initial Render logic
    searchBar.addEventListener('focus', renderSearchHistoryDropdown);

    // 3. Search Handler (Input + Enter)
    searchBar.addEventListener('keyup', (e) => {
        const query = e.target.value.toLowerCase().trim();

        // Si enter -> Guardar en historial
        if (e.key === 'Enter') {
            addToHistory(query);
            searchBar.blur(); // Ocultar teclado
        }

        if (!query) {
            renderSearchHistoryDropdown();
            return;
        }

        // Filtramos objetos
        const filteredData = searchableData.filter(item => item.title.toLowerCase().includes(query));

        if (filteredData.length === 0) {
            searchResultsList.innerHTML = '<li style="opacity: 0.7; padding: 10px;">No se encontraron resultados.</li>';
            return;
        }

        // Renderizado Rico
        searchResultsList.innerHTML = filteredData.map(item => `
            <li class="search-item" tabindex="0" data-type="${item.type}" data-id="${item.id}" data-title="${item.title}">
                <div class="result-content">
                    <h4>${item.title}</h4>
                    <small>${item.context}</small>
                </div>
                <span class="badged">${item.type.toUpperCase()}</span>
            </li>
        `).join('');
    });

    // 4. Click Handler for Search Results & History
    searchResultsList.addEventListener('click', (e) => {
        const historyItem = e.target.closest('.history-item');
        const searchItem = e.target.closest('.search-item:not(.history-item)');

        if (historyItem) {
            const term = historyItem.dataset.term;
            searchBar.value = term;
            // Trigger search manually
            const event = new KeyboardEvent('keyup', { 'key': 'Enter' });
            searchBar.dispatchEvent(event); // Re-run logic
            // Add to history again (move to top)
            addToHistory(term);
            return; // Stop here
        }

        if (searchItem) {
            const type = searchItem.dataset.type;
            const id = searchItem.dataset.id;
            const title = searchItem.dataset.title;

            // Persist the search term if it was a real search
            if (searchBar.value) addToHistory(searchBar.value);

            handleSmartRouting(type, id, title);
        }
    });

    // --- SMART ROUTING LOGIC ---
    function handleSmartRouting(type, id, title) {
        console.log(`Routing to: Type=${type}, ID=${id}, Title=${title}`);

        switch (type) {
            case 'forum':
                // Extraer nombre real del foro si es "Foro: X"
                let forumTitle = title.replace('Foro: ', '');
                showScreen('forum-posts-screen', { title: forumTitle });
                break;
            case 'user':
                showScreen('other-profile-screen', { id: id }); // Mock ID
                break;
            case 'chat':
                showScreen('chat-screen');
                break;
            case 'news':
                // Simulamos detalle de noticia (puedes crear pantalla dedicada o usar trends)
                alert(`Abriendo noticia: ${title}`);
                // showScreen('news-detail-screen', { id: id }); 
                break;
            default:
                console.warn('Tipo de resultado desconocido:', type);
        }
    }

    // --- History Screen Logic (Separado) ---
    // Se llama desde saveSearchHistory y al cargar la pantalla
    function renderFullHistoryScreen() {
        const container = document.getElementById('history-list-container');
        if (!container) return;

        if (searchHistory.length === 0) {
            container.innerHTML = '<li style="padding: 20px; text-align: center; opacity: 0.6;">Sin historial reciente.</li>';
            return;
        }

        container.innerHTML = searchHistory.map(term => `
            <li tabindex="0" onclick="performGlobalSearch('${term}')">
                "${term}" <small>Reciente</small>
            </li>
        `).join('');
    }

    // Expose Global Helper for referencing in onclick attributes if needed (though we use listeners mostly)
    window.performGlobalSearch = function (term) {
        showScreen('search-screen');
        const searchBar = document.getElementById('search-bar');
        searchBar.value = term;
        searchBar.focus();
        // Trigger filter
        searchBar.dispatchEvent(new Event('keyup'));
        addToHistory(term);
    };

    // Initial Render
    renderFullHistoryScreen();

    // l) Formulario de Comentarios
    document.getElementById('comment-form').addEventListener('submit', (e) => {
        e.preventDefault();

        if (currentUser.isGuest) {
            showError("Debes iniciar sesión para comentar.");
            return;
        }

        const input = e.target.querySelector('input');
        const message = input.value.trim();
        if (!message) return;

        const postId = e.target.dataset.postId;
        const newComment = {
            id: Date.now(),
            author: currentUser.name,
            body: message,
            likes: 0,
            dislikes: 0
        };

        if (!allComments[postId]) {
            allComments[postId] = [];
        }
        allComments[postId].push(newComment);

        renderComments(postId); // Re-renderiza la lista de comentarios
        input.value = '';
    });

    // Función para renderizar comentarios
    function renderComments(postId) {
        const container = document.getElementById('comment-thread-container');
        const comments = allComments[postId];

        if (!comments || comments.length === 0) {
            container.innerHTML = '<li style="opacity: 0.7; text-align: center; padding: 20px 0;">No hay comentarios todavía.</li>';
            return;
        }

        container.innerHTML = ''; // Limpia
        comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment-card';
            commentEl.dataset.commentId = comment.id; // Añade ID para likes
            commentEl.innerHTML = `
                <div class="comment-header">
                    <span class="avatar-icon small" aria-hidden="true"><i class="ph ph-user"></i></span>
                    <strong>${comment.author}</strong>
                </div>
                <p class="comment-body">${comment.body}</p>
                <div class="comment-actions">
                    <button class="btn-thumb-up" aria-label="${comment.likes} Me gusta"><i class="ph ph-thumbs-up"></i> ${comment.likes}</button>
                    <button class="btn-thumb-down" aria-label="${comment.dislikes} No me gusta"><i class="ph ph-thumbs-down"></i> ${comment.dislikes}</button>
                </div>
            `;
            container.appendChild(commentEl);
        });
    }

    // m) Lógica de Edición de Perfil
    const profileEditables = [
        { btn: 'edit-name-btn', display: 'edit-name-display', input: 'edit-name-input' },
        { btn: 'edit-desc-btn', display: 'edit-desc-display', input: 'edit-desc-input' }
    ];

    profileEditables.forEach(item => {
        document.getElementById(item.btn).addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById(item.input).style.display = 'none';
            document.getElementById(item.display).style.display = 'flex';
        });
    });

    // Avatar Upload Logic
    const avatarInput = document.getElementById('avatar-upload');
    const avatarBtn = document.getElementById('btn-edit-avatar');
    if (avatarBtn && avatarInput) {
        avatarBtn.addEventListener('click', () => {
            avatarInput.click();
        });

        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    // Set for current session
                    currentUser.avatar = event.target.result;
                    // Update previews
                    document.querySelectorAll('.avatar.large').forEach(el => {
                        el.style.backgroundImage = `url('${currentUser.avatar}')`;
                        el.style.backgroundSize = 'cover';
                    });
                    // Tiny avatars
                    document.querySelectorAll('.header-user-btn .ph-user').forEach(icon => {
                        // Replace icon with image or set background on parent button?
                        // For simplicity, let's keep icon for now or just alert.
                        // Actually, let's try to update if we can access the button style
                    });
                };
                reader.readAsDataURL(file);
            }
        });
    }

    document.getElementById('save-profile-btn').addEventListener('click', () => {
        const newName = document.querySelector('#edit-name-input input').value;
        const newDesc = document.querySelector('#edit-desc-input textarea').value;

        userProfile.name = newName;
        userProfile.desc = newDesc;

        document.getElementById('profile-name').innerText = newName;
        document.getElementById('profile-desc').innerText = newDesc;

        // Actualiza el display también
        document.querySelector('#edit-name-display span').innerText = newName;
        document.querySelector('#edit-desc-display p').innerText = newDesc;

        showSuccess("Perfil guardado (simulado).");
        profileEditables.forEach(item => {
            document.getElementById(item.display).style.display = 'flex';
            document.getElementById(item.input).style.display = 'none';
        });
        showScreen('profile-screen');
    });

    // n) Lógica para el formulario de Nueva Publicación
    document.getElementById('new-post-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const title = document.getElementById('post-title').value;
        const content = document.getElementById('post-content').value;
        const forum = document.getElementById('post-forum').value;

        if (title && content && forum) {
            // Simular publicación
            // Guardar en array (opcional para el prototipo)
            const newPost = {
                id: Date.now(),
                title: title,
                content: content,
                forum: forum,
                author: currentUser.name,
                likes: '0',
                comments: '0',
                shares: '0'
            };
            forumPosts.unshift(newPost); // Add to beginning

            showSuccess(`Publicación creada con éxito en el foro "${forum}". Te hemos enviado un correo de confirmación.`);

            document.getElementById('new-post-form').reset();
            // Volver al foro seleccionado o lista de foros
            showScreen('communities-posts-screen'); // Or specific forum screen if possible
        } else {
            showError('Por favor rellena todos los campos');
        }
    });

    // o) Función para crear HTML de Post
    function createPostHTML(post, isNavigable = true) {
        const navClass = isNavigable ? 'nav-link' : '';
        const navTarget = isNavigable ? `data-target="comments-screen"` : '';
        const navPostId = isNavigable ? `data-post-id="${post.id}"` : '';
        const tabIndex = isNavigable ? `tabindex="0"` : '';

        // Post no navegable (vista detalle)
        if (!isNavigable) {
            return `
                <article class="post-card">
                    <header class="post-header">
                        <span class="avatar-icon post-avatar" aria-hidden="true"><i class="ph ph-user"></i></span>
                        <strong>${post.author}</strong>
                    </header>
                    <div class="post-content">
                        <strong>${post.title}</strong>
                        <p>${post.content}</p>
                    </div>
                </article>
             `;
        }

        // Post navegable (lista)
        return `
            <article class="post-card ${navClass}" ${navTarget} ${navPostId} ${tabIndex}>
                <header class="post-header">
                    <span class="avatar-icon post-avatar" aria-hidden="true"><i class="ph ph-user"></i></span>
                    <strong class="nav-link" data-target="other-profile-screen">${post.author}</strong>
                    <button class="btn-follow">Seguir</button>
                </header>
                <div class="post-content">
                    <strong>${post.title}</strong>
                    <p>${post.content}</p>
                </div>
                <footer class="post-actions">
                    <button class="btn-like" data-post-id="${post.id}" aria-label="${post.likes || 0} Me gusta"><i class="ph ph-thumbs-up"></i> ${post.likes || 0}</button>
                    <button class="btn-comment" aria-label="${post.comments || 0} Comentarios"><i class="ph ph-chat-circle"></i> ${post.comments || 0}</button>
                    <button class="btn-share" data-share-title="${post.title}" aria-label="${post.shares || 0} Compartidos"><i class="ph ph-share-fat"></i> ${post.shares || 0}</button>
                </footer>
            </article>
        `;
    }

    // p) Lector de Pantalla (Simulado)
    // p) Lector de Pantalla (Simulado) - (Lógica movida al listener de Toggles)

    document.addEventListener('click', (e) => {
        if (!isScreenReaderEnabled) return;

        if (e.target.closest('#accessibility-screen')) return;

        const clickable = e.target.closest('button, .nav-link, .nav-btn, .list-view li, .trends-card');
        if (!clickable) return;

        let textToSpeak = clickable.getAttribute('aria-label');
        if (!textToSpeak) {
            textToSpeak = clickable.innerText;
        }

        if (textToSpeak) {
            // Limpieza básica de emojis para que la voz no diga cosas raras si no soporta
            textToSpeak = textToSpeak.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').replace(/\n/g, ' ').trim();

            if (textToSpeak) {
                speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                speechSynthesis.speak(utterance);
            }
        }
    }, true);

    // --- 6. INICIALIZACIÓN ---
    showScreen('login-screen');
});