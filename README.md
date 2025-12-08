# 🐼 Panda Loterias

![Project Status](https://img.shields.io/badge/status-active-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

> Uma plataforma completa e moderna para gestão de apostas e loterias, com integração de pagamentos Pix automatizados e painel administrativo robusto.

---

## 📸 Screenshots

| Tela Inicial (Mobile) | Painel Administrativo |
|:---------------------:|:---------------------:|
| ![Home Mobile](https://via.placeholder.com/250x500?text=Home+Screen) | ![Admin Dashboard](https://via.placeholder.com/600x350?text=Admin+Dashboard) |
---

## 🚀 Sobre o Projeto

O **Panda Loterias** é uma aplicação web Fullstack desenvolvida para facilitar e gerenciar apostas em diversas modalidades de loteria (Tradicional, Quininha, Seninha, etc.). O sistema conta com uma carteira digital integrada, permitindo depósitos automáticos via Pix e gestão de saldo em tempo real.

### Principais Funcionalidades

* 🔐 **Autenticação Segura:** Login e Registro com JWT e Cookies HttpOnly.
* 💰 **Carteira Digital:** Integração com **SuitPay** para depósitos Pix com QR Code e Copia e Cola.
* 🎲 **Sistema de Apostas:** Validação de regras, cálculo de prêmios e múltiplas modalidades.
* 📊 **Painel Administrativo (PLA):** Gestão de usuários, conferência de resultados, fluxo de caixa e supervisores.
* 📱 **Design Responsivo:** Interface "Mobile-First" construída com **Tailwind CSS**.
* 🛡️ **Segurança:** Proteção contra manipulação de saldo e validação de dados com Zod.

---

## 🛠️ Tecnologias Utilizadas

O projeto foi desenvolvido utilizando as seguintes tecnologias:

### Frontend
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=react-router&logoColor=white)

### Backend
![NodeJS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)

---

## ⚙️ Como Executar

Siga os passos abaixo para rodar o projeto localmente.

### Pré-requisitos
* Node.js (v18 ou superior)
* NPM ou Yarn

### Instalação

1.  **Clone o repositório**
    ```bash
    git clone [https://github.com/seu-usuario/panda-loterias.git](https://github.com/seu-usuario/panda-loterias.git)
    cd panda-loterias
    ```

2.  **Instale as dependências**
    ```bash
    npm install
    ```

3.  **Configure as Variáveis de Ambiente**
    Crie um arquivo `.env` na raiz do projeto e preencha conforme o modelo:

    ```env
    # Servidor
    PORT=4000
    DATABASE_URL="file:./dev.db"
    JWT_SECRET="sua_chave_secreta_super_segura"
    
    # Frontend
    VITE_API_BASE_URL="/api"

    # Integração SuitPay (Pix)
    SUITPAY_BASE_URL="[https://ws.suitpay.app/api/v1](https://ws.suitpay.app/api/v1)"
    SUITPAY_CLIENT_ID="seu_client_id"
    SUITPAY_CLIENT_SECRET="seu_client_secret"
    SUITPAY_WEBHOOK_TOKEN="token_para_seguranca_do_webhook"
    ```

4.  **Configure o Banco de Dados**
    ```bash
    npx prisma migrate dev --name init
    ```

5.  **Inicie a Aplicação**
    Você precisará de dois terminais (ou configurar o concurrently):

    *Terminal 1 (Backend):*
    ```bash
    node index.js
    ```

    *Terminal 2 (Frontend):*
    ```bash
    npm run dev
    ```

6.  Acesse `http://localhost:5173` no seu navegador.

---

## 📂 Estrutura do Projeto

├── prisma/ # Schemas e migrações do Banco de Dados ├── src/ │ ├── assets/ # Imagens e recursos estáticos │ ├── components/ # Componentes Reutilizáveis (Cards, Spinner, Layouts) │ ├── context/ # Context API (AuthContext) │ ├── controllers/ # Lógica de negócio (Auth, Bet, Wallet, Pix) │ ├── middleware/ # Middlewares de proteção (Auth, AdminOnly) │ ├── pages/ # Páginas da aplicação (Admin e User) │ ├── routes/ # Definição das rotas da API │ ├── services/ # Serviços auxiliares │ └── utils/ # Funções utilitárias (API axios, formatadores) └── index.js # Ponto de entrada do Backend

---

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir uma issue ou enviar um Pull Request.

1.  Faça um Fork do projeto
2.  Crie uma Branch para sua Feature (`git checkout -b feature/MinhaFeature`)
3.  Faça o Commit (`git commit -m 'Adicionando nova feature'`)
4.  Faça o Push (`git push origin feature/MinhaFeature`)
5.  Abra um Pull Request

---

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<p align="center">
  Feito com 💚 por <a href="https://github.com/dev-guirocha">Guilherme Rocha.</a>
</p>