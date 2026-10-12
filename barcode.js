/* ============================================================
   barcode.js — Leitura de código de barras
   - Leitor físico (USB/Bluetooth) que funciona como teclado:
     detecta digitação rápida seguida de Enter.
   - Leitura por câmera via ZXing (carregado por CDN no index.html).
   ============================================================ */
const Barcode = (() => {
  let buffer = '';
  let lastKeyTime = 0;
  let physicalCallback = null;
  const KEY_INTERVAL_MS = 50;   // intervalo máximo entre teclas de um leitor
  const MIN_LENGTH = 4;          // tamanho mínimo para considerar um código

  // Detecta leitura de leitor físico em qualquer input focado ou no corpo da página.
  // Evita disparar quando o usuário está digitando num campo de texto normal.
  function onKeydown(e) {
    if (!physicalCallback) return;
    const target = e.target;
    const isTypingField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    // Se o foco está no campo dedicado de código do PDV, deixe o input tratar (ele já lê Enter).
    if (isTypingField && target.id === 'pdv-codigo') return;
    const now = Date.now();
    if (now - lastKeyTime > KEY_INTERVAL_MS) buffer = '';
    lastKeyTime = now;
    if (e.key === 'Enter') {
      const code = buffer.trim();
      buffer = '';
      if (code.length >= MIN_LENGTH && /^\d+$/.test(code)) {
        e.preventDefault();
        physicalCallback(code);
      }
      return;
    }
    if (e.key.length === 1 && /[\dA-Za-z-]/.test(e.key)) buffer += e.key;
    // Segurança: limpa buffer se ficar muito grande sem Enter
    if (buffer.length > 32) buffer = '';
  }

  function enablePhysicalScanner(callback) {
    physicalCallback = callback;
    document.addEventListener('keydown', onKeydown);
  }
  function disablePhysicalScanner() {
    physicalCallback = null;
    document.removeEventListener('keydown', onKeydown);
    buffer = '';
  }

  // Câmera via ZXing
  let codeReader = null;
  let cameraControl = null;
  let cameraActive = false;

  async function startCamera(videoEl, onDetected) {
    if (typeof ZXingBrowser === 'undefined') {
      return { ok: false, erro: 'Biblioteca de leitura não carregou. Verifique sua conexão.' };
    }
    try {
      if (!codeReader) codeReader = new ZXingBrowser.BrowserMultiFormatReader();
      const controls = await codeReader.decodeFromVideoDevice(undefined, videoEl, (result, err) => {
        if (result) {
          const text = result.getText();
          if (text && text.length >= MIN_LENGTH) {
            // Debounce: evita leituras duplicadas consecutivas do mesmo código
            const now = Date.now();
            if (now - startCamera._lastRead < 1500 && startCamera._lastCode === text) return;
            startCamera._lastRead = now;
            startCamera._lastCode = text;
            onDetected(text);
          }
        }
      });
      cameraControl = controls;
      cameraActive = true;
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: err && err.message ? err.message : 'Não foi possível acessar a câmera. Verifique a permissão.' };
    }
  }
  startCamera._lastRead = 0;
  startCamera._lastCode = '';

  function stopCamera() {
    try { if (cameraControl) cameraControl.stop(); } catch (e) {}
    cameraControl = null;
    cameraActive = false;
    const v = document.getElementById('barcode-video');
    if (v && v.srcObject) {
      v.srcObject.getTracks().forEach(t => t.stop());
      v.srcObject = null;
    }
  }

  // Busca produto no estoque por código de barras / SKU.
  // Suporta múltiplos códigos por produto (campo "codigos" array).
  function lookupProduto(db, codigo) {
    if (!codigo) return null;
    const c = String(codigo).trim();
    return db.estoque.find(p => {
      if (p.codigo && String(p.codigo).trim() === c) return true;
      if (Array.isArray(p.codigos) && p.codigos.some(x => String(x).trim() === c)) return true;
      return false;
    }) || null;
  }

  // Validação básica de EAN-13 / GTIN (checksum). Não bloqueia, só informa.
  function validarEAN(code) {
    const c = String(code).replace(/\D/g, '');
    if (c.length !== 13 && c.length !== 8 && c.length !== 12) return { valido: false, tipo: 'Código', mensagem: 'Formato não reconhecido como EAN/GTIN. Será usado como código interno.' };
    let sum = 0;
    for (let i = 0; i < c.length - 1; i++) {
      sum += Number(c[i]) * (i % 2 === (c.length % 2 === 0 ? 1 : 0) ? 3 : 1);
    }
    const check = (10 - (sum % 10)) % 10;
    const valido = check === Number(c[c.length - 1]);
    return { valido, tipo: c.length === 13 ? 'EAN-13' : c.length === 8 ? 'EAN-8' : 'UPC-A', mensagem: valido ? 'Código válido.' : 'Dígito verificador inconsistente.' };
  }

  return { enablePhysicalScanner, disablePhysicalScanner, startCamera, stopCamera, lookupProduto, validarEAN, isCameraActive: () => cameraActive };
})();
