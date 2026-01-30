# Haules PoS 🍻

Aplicativo de Ponto de Venda (PoS) desenvolvido especialmente para o **Bar do Haules** em Jundiaí. Integrado com MedusaJS para gestão de produtos, Supabase para cupons e PagSeguro para pagamentos.

## 🚀 Principais Funcionalidades

- **🛒 Venda Ágil:** Interface otimizada para atendimento rápido com carrinho expansível por gestos.
- **🔐 Segurança:** Autenticação por biometria (digital/rosto) para os atendentes.
- **🎟️ Sistema de Cupons:** Scanner de QR Code integrado para aplicação de descontos em tempo real.
- **💳 Pagamentos:** Integração com máquinas de cartão PagSeguro (Moderninha/PinPad).
- **📈 Performance:** Sincronização em background com o backend MedusaJS após aprovação do pagamento.

## 🛠️ Stack Tecnológica

- **App:** React Native + Expo (SDK 54)
- **Backend:** [MedusaJS](https://medusajs.com/)
- **Database/Functions:** [Supabase](https://supabase.com/)
- **Pagamentos:** [PagSeguro SDK](https://github.com/medusajs/medusa)

## 📦 Como Instalar e Rodar

### Pré-requisitos
- Node.js & Yarn
- Java SDK 17 (para Android)
- Android SDK instalado em um caminho sem espaços (ex: `C:\AndroidSdk`)

### Configuração do Ambiente
1. Clone o repositório.
2. Instale as dependências:
   ```bash
   yarn install
   ```
3. Configure o arquivo `.env` com as URLs do Medusa e Supabase.
4. Para rodar em desenvolvimento no Android:
   ```bash
   npx expo run:android
   ```

## 🛠️ Geração de APK (Build)

Para gerar um arquivo APK instalável e independente do computador:

1. **Instale o EAS CLI (se não tiver):**
   ```bash
   npm install -g eas-cli
   ```
2. **Faça o login na sua conta Expo:**
   ```bash
   eas login
   ```
3. **Gere o APK localmente (Android):**
   ```bash
   npx expo run:android --variant release
   ```
   *O arquivo APK será gerado em `android/app/build/outputs/apk/release/app-release.apk`.*

---
*Bar do Haules - Raíz, Underground e conceituado.* 🌿🥃
