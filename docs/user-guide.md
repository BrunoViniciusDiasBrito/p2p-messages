# Manual do Usuario

Este manual explica como usar o PeerComms no mesmo dispositivo onde o daemon esta em execucao. O daemon guarda identidade, contatos, mensagens e tokens localmente; ele nao exige uma conta central.

## Antes de comecar

1. Inicie o daemon PeerComms no dispositivo que usara para comunicar.
2. Abra o desktop PeerComms. Em desenvolvimento, a tela fica em `http://127.0.0.1:17400`.
3. Mantenha a URL da API como `http://127.0.0.1:17345`, salvo se o daemon tiver sido iniciado em outra porta.
4. Confirme que o painel de status muda para uma mensagem de sucesso depois de usar Atualizar.

## Primeiro acesso

### 1. Crie ou confira sua identidade

1. Abra a secao **Identidade** e escolha **Carregar**.
2. Localize o seu `peerId`, que comeca com `pc_`.
3. Esse identificador e publico. Voce pode envia-lo para outra pessoa, mas deve confirmar por um canal confiavel antes de aceitar um contato.
4. Nao tente exportar ou compartilhar chaves privadas, senha do vault ou arquivos de backup.

### 2. Registre o aplicativo e gere um token

O token e uma credencial local. Ele nao e obtido em site externo nem enviado por e-mail.

1. Na secao **Integracao**, informe um nome reconhecivel, como `Desktop da Ana` ou `Automacao local`.
2. Escolha **Registrar app**. O campo **App ID** sera preenchido automaticamente.
3. Selecione somente os escopos que a tela ou integracao precisa:
   - `Enviar mensagens`: permite criar mensagens diretas.
   - `Ler mensagens`: reservado para integracoes que precisam consultar historico.
   - `Ler contatos`: reservado para integracoes que precisam consultar contatos.
   - `Receber eventos`: permite receber webhooks e eventos locais.
4. Escolha **Criar token**. O token emitido e associado a esse App ID e aos escopos selecionados.
5. O desktop guarda o token no perfil local da interface para uso cotidiano. Para outro programa, registre outro App ID e gere outro token; nao reutilize indiscriminadamente a mesma credencial.
6. Trate o token como senha. Nao o envie em conversas, capturas de tela, repositorios ou formulários publicos.

## Adicionar um contato

1. Troque os `peerId` publicos com a outra pessoa por um canal confiavel.
2. Em **Contatos**, preencha **Peer local** com o seu identificador e **Peer remoto** com o identificador recebido.
3. Escreva uma mensagem curta de contexto, se for util, e escolha **Enviar solicitacao**.
4. Aguarde a pessoa receber e aprovar a solicitacao no dispositivo dela.
5. So envie mensagens depois que o contato estiver aceito. O PeerComms bloqueia envio direto para contatos pendentes ou bloqueados.

## Enviar uma mensagem direta

1. Em **Mensagens**, informe seu peer ID em **Peer remetente**.
2. Informe o peer ID de um contato aceito em **Peer destinatario**.
3. Escreva a mensagem e escolha **Enfileirar mensagem**.
4. A mensagem e cifrada no dispositivo e entra na fila de entrega. Ela pode permanecer aguardando enquanto o peer estiver indisponivel.
5. Abra **Eventos** e escolha **Conectar** para acompanhar eventos de entrega, conexao e notificacoes.

## Notificacoes e rede

1. Depois de conectar Eventos, o navegador ou webview pode pedir permissao para notificacoes locais. Aceite apenas se quiser alertas no sistema.
2. A secao **Notificacoes** lista avisos persistidos. Use **Marcar como lida** quando um aviso nao precisar mais de atencao.
3. A secao **Alcance da rede** mostra observacoes do transporte local. Um registro `transport:` representa um identificador tecnico do libp2p, nao substitui o peer ID publico de uma pessoa.

## Integrar outro programa local

Cada automacao, plugin ou programa local deve possuir seu proprio App ID e token.

1. Registre o programa com `POST /v1/integrations/apps`, enviando um nome.
2. Gere um token com `POST /v1/integrations/tokens`, enviando o App ID e os escopos minimos.
3. Guarde a resposta do token em um gerenciador de segredos local. O daemon armazena somente o hash da credencial.
4. Envie o token no cabecalho `Authorization: Bearer SEU_TOKEN` quando o endpoint exigir autenticacao.
5. Use `POST /v1/messages/direct` para enfileirar mensagens e `GET /v1/events/stream` para receber eventos SSE locais.
6. Use webhooks somente em enderecos loopback, como `http://127.0.0.1:9000/hook`. O daemon recusa destinos externos.

Exemplo de registro de app:

```bash
curl -X POST http://127.0.0.1:17345/v1/integrations/apps \
  -H "content-type: application/json" \
  -d '{"name":"Minha automacao local"}'
```

Exemplo de envio de mensagem usando um token:

```bash
curl -X POST http://127.0.0.1:17345/v1/messages/direct \
  -H "content-type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"fromPeerId":"pc_seu_id","toPeerId":"pc_contato_id","text":"Ola"}'
```

## Dicas de seguranca

- Confirme peer IDs por outro canal antes de aprovar contatos ou enviar mensagens sensiveis.
- Gere um token separado por aplicativo e conceda apenas os escopos necessarios.
- Revogue e substitua um token que tenha sido exposto.
- Mantenha o daemon e o desktop atualizados.
- Use backup cifrado e uma senha forte para o vault quando esse fluxo estiver habilitado na sua instalacao.

## Solucao de problemas

- **A tela mostra erro de API:** confira se o daemon esta em execucao e se a URL local e a porta estao corretas.
- **Token nao funciona:** registre o app novamente, confira os escopos e gere uma nova credencial; tokens de outro app podem nao ter as permissoes corretas.
- **Mensagem fica na fila:** confirme que o contato foi aceito e que os dois dispositivos possuem alcance de rede.
- **Nao vejo eventos:** escolha Conectar em Eventos, confira a URL da API e permita a notificacao local somente se desejar alertas do sistema.
