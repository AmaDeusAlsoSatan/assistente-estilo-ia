document.addEventListener('DOMContentLoaded', () => {
    // --- REFERÊNCIAS AOS ELEMENTOS ---
    const resultsContainer = document.getElementById('results-container');
    const foldersContainer = document.getElementById('folders-container');
    const createFolderBtn = document.getElementById('create-folder-btn');
    const exportBtn = document.getElementById('export-btn');
    const importInput = document.getElementById('import-input');
    const refineSearchBtn = document.getElementById('refine-search-btn');
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const searchTextBtn = document.getElementById('search-text-btn');
    const searchImageBtn = document.getElementById('search-image-btn');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const newChatBtn = document.getElementById('new-chat-btn'); // Adicionado
    const pinterestBtn = document.getElementById('pinterest-btn');
    const pinterestUrlInput = document.getElementById('pinterest-url');
    const imageInput = document.getElementById('imagem-referencia');
    const imagePreview = document.getElementById('image-preview');
    const productInput = document.getElementById('produto-prompt');
    const tabLinksResults = document.querySelectorAll('.tab-link-results');
    const tabContentsResults = document.querySelectorAll('.tab-content-results');

    let styleBoard = {};
    let lastSearchResults = [];
    let chatHistory = [];

    // --- LÓGICA DAS ABAS ---
    function setupTabs(links, contents) {
        links.forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.getAttribute('data-tab');
                contents.forEach(content => content.classList.remove('active'));
                links.forEach(l => l.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');
                link.classList.add('active');
            });
        });
    }
    setupTabs(tabLinks, tabContents);
    setupTabs(tabLinksResults, tabContentsResults);

    // --- FUNÇÕES DE GESTÃO DO PAINEL DE ESTILO (BOARD) ---
    function loadBoard() {
        const storedBoard = localStorage.getItem('styleBoard');
        if (storedBoard) {
            styleBoard = JSON.parse(storedBoard);
        } else {
            styleBoard['geral'] = { name: 'Favoritos Gerais', items: [] };
        }
        renderBoard();
    }

    function saveBoard() {
        localStorage.setItem('styleBoard', JSON.stringify(styleBoard));
    }

    function renderBoard() {
        foldersContainer.innerHTML = '';
        let totalItems = 0;
        for (const folderId in styleBoard) {
            const folder = styleBoard[folderId];
            totalItems += folder.items.length;
            const folderElement = document.createElement('div');
            folderElement.classList.add('folder');
            const itemsHTML = folder.items.map(item => createResultCard(item, true, true).outerHTML).join('');
            folderElement.innerHTML = `
                <div class="folder-header">
                    <h3>${folder.name} (${folder.items.length}) (Selecione para Refinar a Busca)</h3>
                </div>
                <div class="results-grid">
                    ${itemsHTML}
                </div>
            `;
            foldersContainer.appendChild(folderElement);
        }
        refineSearchBtn.style.display = totalItems > 0 ? 'block' : 'none';
    }

    function addItemToFolder(item, folderId) {
        if (styleBoard[folderId]) {
            const exists = styleBoard[folderId].items.some(i => i.thumbnail === item.thumbnail);
            if (!exists) {
                styleBoard[folderId].items.push(item);
                saveBoard();
                renderBoard();
                renderSearchResults(lastSearchResults);
                alert(`Item adicionado à pasta "${styleBoard[folderId].name}"!`);
            } else {
                alert('Este item já está nessa pasta.');
            }
        }
    }
    
    function removeItem(item) {
        let itemRemoved = false;
        for (const folderId in styleBoard) {
            const folder = styleBoard[folderId];
            const index = folder.items.findIndex(i => i.thumbnail === item.thumbnail);
            if (index > -1) {
                folder.items.splice(index, 1);
                itemRemoved = true;
                break; 
            }
        }
        if (itemRemoved) {
            saveBoard();
            renderBoard();
            renderSearchResults(lastSearchResults);
            alert('Item removido do seu painel.');
        }
    }

    // --- LÓGICA DO MODAL DE SELEÇÃO DE PASTA ---
    function showAddToFolderModal(item) {
        const oldModal = document.querySelector('.modal-overlay');
        if (oldModal) oldModal.remove();
        const modalOverlay = document.createElement('div');
        modalOverlay.classList.add('modal-overlay');
        const folderButtonsHTML = Object.keys(styleBoard).map(folderId =>
            `<button class="folder-choice-btn" data-folder-id="${folderId}">${styleBoard[folderId].name}</button>`
        ).join('');
        modalOverlay.innerHTML = `
            <div class="modal-content">
                <h3>Salvar em qual pasta?</h3>
                <div class="modal-folder-list">
                    ${folderButtonsHTML}
                </div>
            </div>
        `;
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });
        modalOverlay.querySelectorAll('.folder-choice-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const folderId = btn.getAttribute('data-folder-id');
                addItemToFolder(item, folderId);
                modalOverlay.remove();
            });
        });
        document.body.appendChild(modalOverlay);
    }

    // --- FUNÇÃO PARA CRIAR CARDS ---
    function createResultCard(item, isFavorite, isSelectable = false) {
        const card = document.createElement('div');
        card.classList.add('result-card');
        const heartIcon = isFavorite ? '❤️' : '🤍';
        const checkboxHTML = isSelectable ? `<input type="checkbox" class="favorite-checkbox">` : ''; // Corrigido: checkboxes desmarcadas
        card.innerHTML = `
            ${checkboxHTML}
            <a href="${item.link}" target="_blank">
                <img src="${item.thumbnail}" class="result-image" alt="${item.title}">
            </a>
            <div class="card-title">${item.title}</div>
            <div class="card-source">${item.source}</div>
            <button class="favorite-btn">${heartIcon}</button>
        `;
        // O event listener individual foi removido para usar a delegação de eventos
        card.dataset.itemData = JSON.stringify(item);
        return card;
    }

    // --- LÓGICA DE BUSCA ---
    function renderSearchResults(results) {
        resultsContainer.innerHTML = '';
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<p class="placeholder-text">Nenhuma referência encontrada.</p>';
            return;
        }
        lastSearchResults = results;
        results.forEach(item => {
            const isFavorite = Object.values(styleBoard).some(folder => folder.items.some(fav => fav.thumbnail === item.thumbnail));
            const card = createResultCard(item, isFavorite, false);
            resultsContainer.appendChild(card);
        });
    }

    async function performTextSearch(prompt) {
        if (!prompt || prompt.trim() === '') return;
        resultsContainer.innerHTML = `<p class="placeholder-text">A fazer a busca para: "${prompt}"...</p>`;
        try {
            const response = await fetch('/api/search-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ produto: prompt }),
            });
            const data = await response.json();
            if (data.status === 'sucesso' && data.results) {
                renderSearchResults(data.results);
            } else {
                resultsContainer.innerHTML = `<p class="placeholder-text">Erro: ${data.mensagem}</p>`;
            }
        } catch (error) {
            console.error('Erro na comunicação:', error);
            resultsContainer.innerHTML = '<p class="placeholder-text">Erro de comunicação com o servidor.</p>';
        }
    }

    async function performImageSearch() {
        const file = imageInput.files[0];
        if (!file) {
            alert('Por favor, envie uma imagem de referência.');
            return;
        }
        resultsContainer.innerHTML = '<p class="placeholder-text">A fazer a busca visual...</p>';
        const formData = new FormData();
        formData.append('imagem_referencia', file);
        try {
            const response = await fetch('/api/search-image', { method: 'POST', body: formData });
            const data = await response.json();
            if (data.status === 'sucesso' && data.results) {
                renderSearchResults(data.results);
            } else {
                resultsContainer.innerHTML = `<p class="placeholder-text">Erro: ${data.mensagem}</p>`;
            }
        } catch (error) {
            console.error('Erro na comunicação:', error);
            resultsContainer.innerHTML = '<p class="placeholder-text">Erro de comunicação com o servidor.</p>';
        }
    }

    // --- BUSCA REFINADA POR SELEÇÃO ---
    refineSearchBtn.addEventListener('click', () => {
        const selectedCheckboxes = foldersContainer.querySelectorAll('.favorite-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            alert('Por favor, selecione pelo menos um item favorito para refinar a sua busca.');
            return;
        }
        const selectedItems = Array.from(selectedCheckboxes).map(checkbox => {
            return JSON.parse(checkbox.closest('.result-card').dataset.itemData);
        });
        const titles = selectedItems.map(item => item.title).join(' ');
        const stopwords = ['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'no', 'na', 'os', 'as', '-', '|', 'online'];
        const words = titles.toLowerCase().split(/\s+/);
        const keywords = words.filter(word => !stopwords.includes(word) && word.length > 2);
        const uniqueKeywords = [...new Set(keywords)];
        const refinedPrompt = uniqueKeywords.join(' ');
        document.querySelector('.tab-link-results[data-tab="tab-search-results"]').click();
        performTextSearch(refinedPrompt);
    });

    // --- DELEGAÇÃO DE EVENTOS PARA OS BOTÕES DE CORAÇÃO ---
    foldersContainer.addEventListener('click', (event) => {
        const favoriteBtn = event.target.closest('.favorite-btn');
        if (favoriteBtn) {
            const card = event.target.closest('.result-card');
            const itemData = JSON.parse(card.dataset.itemData);
            removeItem(itemData);
        }
    });

    resultsContainer.addEventListener('click', (event) => {
        const favoriteBtn = event.target.closest('.favorite-btn');
        if (favoriteBtn) {
            const card = event.target.closest('.result-card');
            const itemData = JSON.parse(card.dataset.itemData);
            const isCurrentlyFavorite = Object.values(styleBoard).some(folder => folder.items.some(fav => fav.thumbnail === itemData.thumbnail));
            if (isCurrentlyFavorite) {
                removeItem(itemData);
            } else {
                showAddToFolderModal(itemData);
            }
        }
    });

    // --- OUTROS EVENT LISTENERS ---
    function exportBoard() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(styleBoard, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "meu_painel_de_estilo.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        alert('O seu Painel de Estilo foi exportado com sucesso!');
    }

    function importBoard(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (typeof importedData === 'object' && !Array.isArray(importedData)) {
                    styleBoard = importedData;
                    saveBoard();
                    renderBoard();
                    alert('Painel de Estilo importado com sucesso!');
                } else {
                    alert('Erro: O ficheiro selecionado não é um Painel de Estilo válido.');
                }
            } catch (error) {
                alert('Erro ao ler o ficheiro. Certifique-se de que é um .json válido.');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    createFolderBtn.addEventListener('click', () => {
        const folderName = prompt("Qual o nome da nova pasta?");
        if (folderName && folderName.trim() !== '') {
            const folderId = Date.now().toString();
            styleBoard[folderId] = { name: folderName.trim(), items: [] };
            saveBoard();
            renderBoard();
        }
    });
    exportBtn.addEventListener('click', exportBoard);
    importInput.addEventListener('change', importBoard);
    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.classList.remove('image-preview-hidden');
            };
            reader.readAsDataURL(file);
        }
    });
    searchTextBtn.addEventListener('click', () => performTextSearch(productInput.value));
    searchImageBtn.addEventListener('click', performImageSearch);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim() !== '') {
            const userMessage = chatInput.value.trim();
            chatHistory.push(userMessage);
            const messageElement = document.createElement('div');
            messageElement.classList.add('user-message');
            messageElement.innerHTML = `<span>${userMessage}</span>`;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            chatInput.value = '';
            performTextSearch(chatHistory.join('. '));
        }
    });
    pinterestBtn.addEventListener('click', () => {
        const url = pinterestUrlInput.value.trim();
        if (!url.includes('pinterest.com')) {
            alert('Por favor, insira um URL válido do Pinterest.');
            return;
        }
        try {
            const pathParts = new URL(url).pathname.split('/').filter(part => part);
            if (pathParts.length < 2) throw new Error('URL de painel inválido.');
            const boardName = pathParts[pathParts.length - 1].replace(/-/g, ' ');
            alert(`Analisando o estilo do painel: "${boardName}".`);
            performTextSearch(boardName);
        } catch (error) {
            alert('Não foi possível extrair o nome do painel do URL.');
            console.error(error);
        }
    });

    // --- LÓGICA DO BOTÃO "NOVO CHAT" ---
    newChatBtn.addEventListener('click', () => {
        chatHistory = []; // Limpa o histórico da conversa
        chatMessages.innerHTML = ''; // Limpa as mensagens no ecrã
        // Opcional: Adicionar uma mensagem de boas-vindas
        // const welcomeMsg = document.createElement('div');
        // welcomeMsg.innerHTML = '<span>Olá! Descreva o estilo que procura.</span>';
        // chatMessages.appendChild(welcomeMsg);
        chatInput.value = ''; // Limpa o campo de input
        chatInput.focus(); // Coloca o cursor de volta no input
    });

    // --- INICIALIZAÇÃO ---
    loadBoard();
});
