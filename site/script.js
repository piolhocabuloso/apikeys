const apiUrl = "http://localhost:3000";

function abrirModalKeyCriada() {
  document.getElementById('modalKeyCriada').style.display = 'flex';
}
function fecharModalKeyCriada() {
  document.getElementById('modalKeyCriada').style.display = 'none';
}
document.getElementById('btnCloseKeyCriada').addEventListener('click', fecharModalKeyCriada);

async function criarKey() {
  let key = document.getElementById("keyInput").value.trim();

  if (!key) {
    key = gerarKeyAleatoria();
  }

  const res = await fetch(`${apiUrl}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const j = await res.json();
  if (res.ok) {
    abrirModalKeyCriada();
    carregarLista();
  } else alert(j.error || JSON.stringify(j));
}

async function carregarLista() {
  const res = await fetch(`${apiUrl}/keys`);
  const data = await res.json();
  const ul = document.getElementById("keysList");
  ul.innerHTML = "";

  if (!data.keys || !Array.isArray(data.keys)) {
    ul.innerHTML = "<li class='list-group-item'>Erro ao carregar</li>";
    return;
  }

  data.keys.forEach((r) => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    const criada = new Date(r.created_at).toLocaleString();
    const usada = r.used ? "Sim" : "Não";

    li.innerHTML = `<span class="key-item" style="cursor:pointer;"
      data-criada="${criada}"
      data-usada="${usada}"
      data-user="${r.user || ''}"
      data-expires_at="${r.expires_at || ''}"
    >${r.key}</span>`;

    ul.appendChild(li);
  });
}
// Abrir modal criar múltiplas keys
document.getElementById('btnOpenCriarMultiplas').addEventListener('click', () => {
  document.getElementById('modalCriarMultiplasKeys').style.display = 'flex';
  document.getElementById('inputQuantidadeKeys').value = '';
});

// Cancelar modal
document.getElementById('btnCancelCriarMultiplas').addEventListener('click', () => {
  document.getElementById('modalCriarMultiplasKeys').style.display = 'none';
});

// Confirmar criar múltiplas keys
document.getElementById('btnConfirmCriarMultiplas').addEventListener('click', async () => {
  const qtd = parseInt(document.getElementById('inputQuantidadeKeys').value);
  if (!qtd || qtd < 1 || qtd > 100) {
    alert('Digite uma quantidade válida entre 1 e 100');
    return;
  }

  document.getElementById('modalCriarMultiplasKeys').style.display = 'none';

  // Criar as keys uma a uma
  for (let i = 0; i < qtd; i++) {
    let key = gerarKeyAleatoria();
    try {
      const res = await fetch(`${apiUrl}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const j = await res.json();
      if (!res.ok) {
        console.error(`Erro ao criar key ${key}:`, j.error || JSON.stringify(j));
      }
    } catch (err) {
      console.error('Erro ao criar key:', err);
    }
  }

  abrirModalAviso(`${qtd} keys criadas com sucesso!`);
  carregarLista();
});

// Modal info da key - abrir ao clicar na key
document.getElementById("keysList").addEventListener("click", (e) => {
  let target = e.target;
  while (target && !target.classList.contains("list-group-item")) {
    target = target.parentElement;
  }
  if (!target) return;

  const span = target.querySelector(".key-item");
  if (!span) return;

  document.getElementById("infoKey").textContent = span.textContent;
  document.getElementById("infoCreatedAt").textContent = span.getAttribute("data-criada");
  document.getElementById("infoUsed").textContent = span.getAttribute("data-usada");
  
  const user = span.getAttribute("data-user");
  document.getElementById("infoUser").textContent = user ? user : "Não vinculado";

  const expiresAt = span.getAttribute("data-expires_at");
  document.getElementById("infoExpiresAt").textContent = expiresAt ? expiresAt : "Nunca";


  document.getElementById("modalKeyInfo").style.display = "flex";
});

// Fechar modal info da key
document.getElementById("btnCloseKeyInfo").addEventListener("click", () => {
  document.getElementById("modalKeyInfo").style.display = "none";
});

// Fechar modal info da key clicando fora do conteúdo
document.getElementById("modalKeyInfo").addEventListener("click", (e) => {
  if (e.target.id === "modalKeyInfo") {
    e.target.style.display = "none";
  }
});
// Abrir modal atualizar
document.getElementById('btnOpenUpdateModal').addEventListener('click', () => {
  document.getElementById('modalUpdateKey').style.display = 'flex';
  document.getElementById('currentKeyInput').value = document.getElementById('keyInput').value.trim();
  document.getElementById('newKeyInput').value = '';
});

// Cancelar modal atualizar
document.getElementById('btnCancelUpdate').addEventListener('click', () => {
  document.getElementById('modalUpdateKey').style.display = 'none';
});

// Confirmar atualizar key
document.getElementById('btnConfirmUpdate').addEventListener('click', async () => {
  const currentKey = document.getElementById('currentKeyInput').value.trim();
  const newKey = document.getElementById('newKeyInput').value.trim();

  if (!currentKey) {
    alert('Digite a key atual.');
    return;
  }
  if (!newKey) {
    alert('Digite a nova key.');
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/keys/${encodeURIComponent(currentKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey }),
    });
    const j = await res.json();
    if (res.ok) {
      document.getElementById('modalUpdateKey').style.display = 'none';
      carregarLista();
    } else {
      alert(j.error || JSON.stringify(j));
    }
  } catch (err) {
    alert('Erro ao atualizar key: ' + err.message);
  }
});

// Mostrar modal
document.getElementById('btnCriarTemp').addEventListener('click', () => {
  document.getElementById('modalTempKey').style.display = 'flex';
  document.getElementById('tempKeyInput').value = '';
  document.getElementById('expiryDate').value = '';
});

// Cancelar modal
document.getElementById('btnCancelTemp').addEventListener('click', () => {
  document.getElementById('modalTempKey').style.display = 'none';
});

// Função gerar key aleatória (reutilizar)
function gerarKeyAleatoria(tamanho = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < tamanho; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// Criar key temporária (botão confirmar modal)
document.getElementById('btnConfirmTemp').addEventListener('click', async () => {
  let key = document.getElementById('tempKeyInput').value.trim();
  const expiry = document.getElementById('expiryDate').value;

  if (!expiry) {
    alert('Escolha uma data e hora de expiração.');
    return;
  }

  if (!key) {
    key = gerarKeyAleatoria();
  }

  try {
    const res = await fetch(`${apiUrl}/keys/temporaria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, expires_at: expiry }),
    });
    const j = await res.json();
    if (res.ok) {
      document.getElementById('modalTempKey').style.display = 'none';
      carregarLista();
    } else {
      alert(j.error || 'Erro ao criar key temporária');
    }
  } catch (err) {
    alert('Erro ao criar key temporária: ' + err.message);
  }
});
// Abrir modal marcar usada
document.getElementById('btnOpenMarkUsedModal').addEventListener('click', () => {
  document.getElementById('modalMarkUsed').style.display = 'flex';
  document.getElementById('markUsedKeyInput').value = document.getElementById('keyInput').value.trim();
  document.getElementById('markUsedUserInput').value = '';
});

// Cancelar modal marcar usada
document.getElementById('btnCancelMarkUsed').addEventListener('click', () => {
  document.getElementById('modalMarkUsed').style.display = 'none';
});

// Confirmar marcar usada
document.getElementById('btnConfirmMarkUsed').addEventListener('click', async () => {
  const key = document.getElementById('markUsedKeyInput').value.trim();
  const user = document.getElementById('markUsedUserInput').value.trim();

  if (!key) {
    alert('Digite a key para marcar como usada');
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/keys/${encodeURIComponent(key)}/use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: user || null }),
    });
    const j = await res.json();
    if (res.ok) {
      alert(`Key marcada como usada${user ? ` e vinculada a: ${user}` : ""}`);
      document.getElementById('modalMarkUsed').style.display = 'none';
      carregarLista();
    } else {
      alert(j.error || "Erro ao marcar como usada");
    }
  } catch (err) {
    alert('Erro ao marcar como usada: ' + err.message);
  }
});


async function carregarKeysUsadas() {
  const res = await fetch(`${apiUrl}/keys`); // pega todas
  const data = await res.json();
  const ul = document.getElementById("keysList");
  ul.innerHTML = "";

  if (!data.keys || !Array.isArray(data.keys)) {
    ul.innerHTML = "<li class='list-group-item'>Erro ao carregar</li>";
    return;
  }

  // Filtra só as usadas
  const usadas = data.keys.filter(k => k.used);

  if (usadas.length === 0) {
    ul.innerHTML = "<li class='list-group-item'>Nenhuma key usada encontrada.</li>";
    return;
  }

  usadas.forEach((r) => {
  const li = document.createElement("li");
  li.className = "list-group-item";

  const criada = new Date(r.created_at).toLocaleString();
  const usada = r.used ? "Sim" : "Não";
  const userInfo = r.user ? r.user : "Não vinculado";
  const expira = r.expires_at ? new Date(r.expires_at).toLocaleString() : "Nunca";

  li.innerHTML = `
    <span class="key-item" style="cursor:pointer;"
          data-key="${r.key}"
          data-criada="${criada}"
          data-usada="${usada}"
          data-user="${userInfo}"
          data-expira="${expira}">
      ${r.key}
    </span>`;
  ul.appendChild(li);
});

}

// Botão ver keys usadas
document.getElementById('btnVerUsadas').addEventListener('click', () => {
  carregarKeysUsadas();
  document.getElementById('btnVerUsadas').style.display = 'none';
  document.getElementById('btnVerTodas').style.display = 'inline-block';
});

// Botão voltar para todas as keys
document.getElementById('btnVerTodas').addEventListener('click', () => {
  carregarLista();
  document.getElementById('btnVerTodas').style.display = 'none';
  document.getElementById('btnVerUsadas').style.display = 'inline-block';
});



// Modal aviso simples
function abrirModalAviso(msg) {
  document.getElementById('modalAvisoMsg').innerText = msg;
  document.getElementById('modalAviso').style.display = 'flex';
}
function fecharModalAviso() {
  document.getElementById('modalAviso').style.display = 'none';
}
document.getElementById('btnCloseAviso').addEventListener('click', fecharModalAviso);
function abrirModalConfirm(mensagem) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modalConfirm");
    const msgElem = document.getElementById("modalConfirmMessage");
    const btnOk = document.getElementById("modalConfirmOk");
    const btnCancel = document.getElementById("modalConfirmCancel");

    msgElem.textContent = mensagem;
    modal.style.display = "flex";

    function limpar() {
      modal.style.display = "none";
      btnOk.removeEventListener("click", onOk);
      btnCancel.removeEventListener("click", onCancel);
    }

    function onOk() {
      limpar();
      resolve(true);
    }
    function onCancel() {
      limpar();
      resolve(false);
    }

    btnOk.addEventListener("click", onOk);
    btnCancel.addEventListener("click", onCancel);
  });
}



async function apagarKey() {
  const key = document.getElementById("keyInput").value.trim();
  if (!key) {
    abrirModalAviso("Digite a key para apagar");
    return;
  }

  const res = await fetch(`${apiUrl}/keys`);
  const data = await res.json();
  const keys = data.keys;

  if (!Array.isArray(keys) || keys.length === 0) {
    abrirModalAviso("Nenhuma key para apagar");
    return;
  }

  if (!keys.some((k) => k.key === key)) {
    abrirModalAviso("Key inválida");
    return;
  }

  const confirmou = await abrirModalConfirm(`Confirma apagar a key: ${key}?`);
  if (!confirmou) return;

  const delRes = await fetch(`${apiUrl}/keys/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
  const delJson = await delRes.json();
  if (delRes.ok) {
    abrirModalAviso("Key apagada com sucesso");
    carregarLista();
  } else abrirModalAviso(delJson.error || "Erro ao apagar");
}









document.getElementById('copyIcon').addEventListener('click', copiarKeys);

async function copiarKeys() {
  const res = await fetch(`${apiUrl}/keys`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    alert("Nenhuma key para copiar");
    return;
  }

  const texto = rows.map(r => r.key.trim()).join("\n");

  try {
    await navigator.clipboard.writeText(texto);
    alert("Keys copiadas para a área de transferência!");
  } catch (err) {
    alert("Erro ao copiar as keys: " + err);
  }
}


function exportarKeys() {
  window.open(`${apiUrl}/export/keys.txt`, "_blank");
}

window.addEventListener("load", carregarLista);
