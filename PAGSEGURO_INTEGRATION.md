# Guia de Integração com Maquininha PagSeguro (PlugPag) em React Native (Expo)

## Resumo

Este documento serve como um guia técnico para integrar o SDK de maquininhas (POS) da PagSeguro, conhecido como **PlugPag**, em um aplicativo React Native desenvolvido com Expo.

A integração **não é trivial** e exige desenvolvimento nativo (Java/Kotlin para Android, Swift/Objective-C para iOS). Não existe um SDK oficial "plug-and-play" para React Native para este caso de uso (conectar um celular a uma maquininha externa via Bluetooth).

Este guia descreve os passos necessários que um desenvolvedor com experiência em desenvolvimento nativo precisará seguir.

---

## 1. Compatibilidade de Hardware

A boa notícia é que o SDK PlugPag suporta uma vasta gama de maquininhas, incluindo modelos mais antigos que se conectam via Bluetooth a um celular. A lista inclui:

-   Moderninha Pro
-   Moderninha Wifi
-   Minizinha
-   Leitores Mini

Isso torna a solução viável para o cenário de um estabelecimento com hardware mais antigo.

---

## 2. Pré-requisitos

Antes de começar a codificar, é necessário garantir os seguintes pré-requisitos:

1.  **Conta de Vendedor PagBank:** É necessário ter uma conta de vendedor ativa para obter as credenciais de produção.
2.  **Ambiente de Desenvolvimento Nativo:**
    -   **Android:** Android Studio instalado e configurado.
    -   **iOS:** Xcode instalado e configurado (requer um macOS).
3.  **Gerar as Pastas Nativas no Expo:** Este projeto usa Expo. Como a integração depende de código nativo, é obrigatório gerar as pastas `android` e `ios`. Rode o seguinte comando na raiz do projeto:
    ```bash
    npx expo prebuild
    ```
    **Atenção:** Após rodar o `prebuild`, o fluxo de desenvolvimento muda. Você não poderá mais usar o app Expo Go para testar. Será necessário rodar o app diretamente em um emulador/dispositivo a partir do Android Studio ou Xcode, ou usar um "development client" com `npx expo start --dev-client`.
4.  **SDKs Nativos (PlugPag):** O desenvolvedor precisará baixar os SDKs nativos (arquivos `.aar`/`.jar` para Android, `.framework` para iOS) diretamente do portal de desenvolvedores do PagBank.

---

## 3. Visão Geral do Processo de Integração

A integração consiste em "ensinar" o React Native a conversar com as funcionalidades nativas do SDK PlugPag. Isso é feito através de uma **Bridge** (Ponte Nativa).

### Passo 1: Download e Configuração do SDK Nativo

-   Acesse o portal de desenvolvedores do PagBank: [https://pagbank.com.br/desenvolvedores](https://pagbank.com.br/desenvolvedores)
-   Navegue até a seção de **PlugPag** e faça o download dos SDKs para **Android** e **iOS**.
-   Siga as instruções da documentação oficial para adicionar esses arquivos aos seus respectivos projetos nativos (`/android` e `/ios`). Isso geralmente envolve editar arquivos como `build.gradle` (Android) e configurar o `Linked Frameworks and Libraries` no Xcode (iOS).

### Passo 2: Desenvolvimento do Módulo Nativo (A "Bridge")

Esta é a parte mais complexa. O desenvolvedor precisará criar módulos nativos que "embrulham" as funções do SDK PlugPag.

**Para Android (exemplo em Java):**

1.  Crie uma nova classe Java (ex: `PagSeguroModule.java`) que estende `ReactContextBaseJavaModule`.
2.  Crie métodos nesta classe anotados com `@ReactMethod`. Estes serão os métodos que o seu JavaScript poderá chamar.
3.  Dentro desses métodos, use o SDK PlugPag para realizar as ações. Exemplo de métodos a serem criados:
    -   `init(Promise promise)`: Para inicializar o SDK.
    -   `requestPayment(int amount, Promise promise)`: Para iniciar uma transação. O `amount` virá do JS. O `Promise` é usado para retornar o resultado (sucesso ou erro) de forma assíncrona para o JS.
    -   `getLastTransaction(Promise promise)`: Para obter informações da última transação.
4.  A comunicação com o SDK PlugPag é assíncrona. Você precisará implementar os `listeners` do SDK e usar o objeto `Promise` para notificar o lado do React Native quando a operação terminar (ex: pagamento aprovado, recusado, ou erro de conexão).
5.  Registre este módulo nativo criando uma classe `PagSeguroPackage.java` que implementa `ReactPackage`.

**Para iOS (exemplo em Swift):**
O processo é similar, mas com as APIs do iOS.
1. Crie um arquivo `PagSeguroModule.swift` e um arquivo de header (`.h`) para expor os métodos para o Objective-C, que é a base da bridge do React Native.
2. Use as anotações `@objc` para expor os métodos.
3. Dentro dos métodos, utilize o framework do PlugPag para iOS para realizar as mesmas operações (inicializar, pagar, etc.).
4. Use `RCTPromiseResolveBlock` e `RCTPromiseRejectBlock` para retornar os resultados para o JavaScript.

### Passo 3: Criação do Wrapper em JavaScript

Para facilitar o uso no resto do app, crie um arquivo, por exemplo, `lib/PagSeguroModule.ts`:

```typescript
import { NativeModules } from 'react-native';

const { PagSeguroModule } = NativeModules;

interface IPagSeguroModule {
  init(): Promise<string>;
  requestPayment(amount: number): Promise<any>; // Defina um tipo para a resposta
  // ... outros métodos
}

export default PagSeguroModule as IPagSeguroModule;
```

### Passo 4: Implementação no `CartContext.tsx`

Finalmente, com a bridge pronta, a implementação no `CartContext` se torna possível e limpa.

No arquivo `contexts/CartContext.tsx`, dentro da função `confirmOrder`, no local indicado (linha 124):

```typescript
// ... dentro de confirmOrder
import PagSeguroModule from '../lib/PagSeguroModule'; // Importe o módulo criado

// ...

    try {
      setIsLoading(true);

      // --- INÍCIO DA IMPLEMENTAÇÃO PAGSEGURO ---
      console.log(`Iniciando pagamento de R$${total.toFixed(2)} na maquininha...`);

      // O valor deve ser passado em centavos
      const totalInCents = Math.round(total * 100);

      // A chamada para o método nativo, que agora existe graças à Bridge
      const paymentResponse = await PagSeguroModule.requestPayment(totalInCents);

      console.log('Resposta da maquininha:', paymentResponse);
      // Aqui você pode verificar se 'paymentResponse' indica sucesso
      // --- FIM DA IMPLEMENTAÇÃO PAGSEGURO ---


      // Restante do código que só executa se o pagamento for um sucesso
      const { data, error } = await supabase
        .from("orders")
        .insert([
          {
            // ...
          },
        ])
        .select();

      if (error) throw error;

      // ... limpar o carrinho, etc.

    } catch (error: any) {
      console.error("Erro ao finalizar compra ou no pagamento:", error);
      Alert.alert("Erro", "Não foi possível finalizar a compra. " + error.message);
    } finally {
      setIsLoading(false);
    }

// ...
```

---

## 4. Considerações Finais

-   **Segurança:** A abordagem de Bridge Nativa é segura, pois suas chaves e tokens de autenticação da PagSeguro ficam no lado nativo e não são expostos no JavaScript.
-   **Manutenção:** Esta é uma solução complexa que exigirá manutenção. Se a PagSeguro atualizar o SDK PlugPag, o código da bridge nativa precisará ser atualizado também.
-   **Alternativa:** Se o desenvolvimento nativo for um impedimento muito grande, a única outra alternativa seria usar um terminal que suporte uma API baseada em nuvem (REST), mas isso não se aplica às maquininhas mais antigas que dependem de Bluetooth.

Este documento deve fornecer um roteiro claro para a implementação. Boa sorte!
