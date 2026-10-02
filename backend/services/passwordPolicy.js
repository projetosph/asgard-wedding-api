function validarSenha(senha) {
  const valor = String(senha || "");

  const erros = [];

  if (valor.length < 8) {
    erros.push("A senha deve ter pelo menos 8 caracteres.");
  }

  if (!/[A-Za-zÀ-ÿ]/.test(valor)) {
    erros.push("A senha deve conter pelo menos uma letra.");
  }

  if (!/\d/.test(valor)) {
    erros.push("A senha deve conter pelo menos um número.");
  }

  return {
    valida: erros.length === 0,
    erros
  };
}

module.exports = {
  validarSenha
};
