// ── MODO PRESENTACION PARA TIC2Hub ──────────────────────────────────────────

let presentationMode = false;
let slides = [];
let currentSlideIndex = 0;

window.togglePresentation = function() {
    let overlay = document.getElementById('presentation-overlay');
    
    // Si no existe, inyectarlo
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'presentation-overlay';
        overlay.innerHTML = `
            <div id="presentation-content"></div>
            <div id="presentation-controls">
                <button class="pres-btn" onclick="window.prevSlide()">⬅ Anterior</button>
                <span id="presentation-counter">1 / 1</span>
                <button class="pres-btn" onclick="window.nextSlide()">Siguiente ➡</button>
                <button class="pres-btn pres-btn-danger" style="margin-left:auto;" onclick="window.togglePresentation()">✕ Cerrar</button>
            </div>
        `;
        document.body.appendChild(overlay);

        // Estilos
        const style = document.createElement('style');
        style.textContent = `
            #presentation-overlay {
                position: fixed;
                inset: 0;
                background-color: #f8f9fa; /* FONDO CLARO PARA PROYECTORES */
                z-index: 99999;
                display: flex;
                flex-direction: column;
                color: #333;
                font-family: system-ui, sans-serif;
            }
            #presentation-content {
                flex: 1;
                overflow-y: auto;
                padding: 50px 10%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .presentation-slide {
                max-width: 900px;
                width: 100%;
                font-size: 1.5rem; /* Texto más grande para proyector */
                line-height: 1.6;
            }
            .presentation-slide h1 { font-size: 3rem; margin-bottom: 20px; color: #2c3e50; }
            .presentation-slide h2 { font-size: 2.2rem; margin-top: 30px; color: #4a90e2; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .presentation-slide p, .presentation-slide li { margin-bottom: 15px; }
            .presentation-slide img { max-width: 100%; height: auto; display: block; margin: 20px auto; }
            #presentation-controls {
                background: #2c3e50;
                padding: 15px 30px;
                display: flex;
                align-items: center;
                box-shadow: 0 -4px 10px rgba(0,0,0,0.1);
            }
            .pres-btn {
                background: transparent;
                border: 2px solid #ecf0f1;
                color: #ecf0f1;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 1.1rem;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
            }
            .pres-btn:hover { background: #ecf0f1; color: #2c3e50; }
            .pres-btn-danger { border-color: #e74c3c; color: #e74c3c; }
            .pres-btn-danger:hover { background: #e74c3c; color: white; }
            #presentation-counter { color: white; font-size: 1.2rem; font-weight: bold; margin: 0 30px; }
            body.presentation-active { overflow: hidden; }
        `;
        document.head.appendChild(style);
    }
    
    if (presentationMode) {
        // Cerrar
        presentationMode = false;
        overlay.style.display = 'none';
        document.body.classList.remove('presentation-active');
        document.getElementById('presentation-content').innerHTML = '';
        slides = [];
    } else {
        // Abrir
        presentationMode = true;
        overlay.style.display = 'flex';
        document.body.classList.add('presentation-active');
        
        buildSlides();
        currentSlideIndex = 0;
        showSlide(currentSlideIndex);
    }
};

function buildSlides() {
    slides = [];
    
    let currentSlide = document.createElement('div');
    currentSlide.className = 'presentation-slide';
    
    let elementsToProcess = [];
    
    // Ignoramos el header, los scripts, y el test de evaluación
    Array.from(document.body.children).forEach(child => {
        const tag = child.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || child.id === 'presentation-overlay' || child.id === 'theory-test-container' || child.querySelector('button[onclick="history.back()"]')) {
            return;
        }
        
        if (tag === 'section') {
            Array.from(child.children).forEach(subchild => elementsToProcess.push(subchild));
        } else {
            elementsToProcess.push(child);
        }
    });

    // Separadores de diapositiva
    const splitTags = ['h1', 'h2', 'h3', 'h4'];
    
    elementsToProcess.forEach(child => {
        
        const tag = child.tagName.toLowerCase();
        let isCardOrBox = false;
        if (child.className && typeof child.className === 'string') {
            isCardOrBox = child.className.includes('info-box') || child.className.includes('-card') || child.className.includes('task-link');
        }
        let shouldSplit = splitTags.includes(tag) || tag === 'hr' || isCardOrBox;

        
        if (shouldSplit) {
            if (currentSlide.innerHTML.trim() !== '') {
                slides.push(currentSlide);
            }
            currentSlide = document.createElement('div');
            currentSlide.className = 'presentation-slide';
            if (child.tagName.toLowerCase() === 'hr') return; // Saltamos los HRs en modo presentación
        }
        
        currentSlide.appendChild(child.cloneNode(true));
    });
    
    if (currentSlide.innerHTML.trim() !== '') {
        slides.push(currentSlide);
    }
}

function showSlide(index) {
    const content = document.getElementById('presentation-content');
    const counter = document.getElementById('presentation-counter');
    
    content.innerHTML = '';
    
    if (slides[index]) {
        content.appendChild(slides[index]);
    }
    
    counter.textContent = `${index + 1} / ${slides.length}`;
    content.scrollTop = 0;
}

window.nextSlide = function() {
    if (currentSlideIndex < slides.length - 1) {
        currentSlideIndex++;
        showSlide(currentSlideIndex);
    }
};

window.prevSlide = function() {
    if (currentSlideIndex > 0) {
        currentSlideIndex--;
        showSlide(currentSlideIndex);
    }
};

// Navegación con teclado
document.addEventListener('keydown', (e) => {
    if (!presentationMode) return;
    
    if (e.key === 'ArrowRight' || e.key === 'Space') { 
        e.preventDefault(); 
        window.nextSlide(); 
    }
    if (e.key === 'ArrowLeft') { 
        e.preventDefault(); 
        window.prevSlide(); 
    }
    if (e.key === 'Escape') { 
        e.preventDefault(); 
        window.togglePresentation(); 
    }
    if (e.key === 'ArrowDown') { 
        e.preventDefault(); 
        document.getElementById('presentation-content').scrollBy({ top: 150, behavior: 'smooth' }); 
    }
    if (e.key === 'ArrowUp') { 
        e.preventDefault(); 
        document.getElementById('presentation-content').scrollBy({ top: -150, behavior: 'smooth' }); 
    }
});
