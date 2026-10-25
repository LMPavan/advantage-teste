# Guia do piloto

Passo a passo para colocar o Preço de Praça no ar e testar com um cliente parceiro.

## 1. Publicar (cerca de 15 minutos)

O repositório já tem um `render.yaml` na raiz, que cria o servidor web e o banco PostgreSQL no [Render](https://render.com).

1. Crie uma conta no Render e conecte o GitHub.
2. Clique em **New > Blueprint** e escolha este repositório e a branch do app.
3. O Render pede estes valores:
   - `CODIGO_CONVITE`: o código que o cliente vai digitar no cadastro (ex.: `PILOTO-2026`). Sem ele, ninguém de fora se cadastra.
   - `ADMIN_EMAIL`: o seu e-mail.
   - `ADMIN_SENHA_INICIAL`: uma senha com 10 ou mais caracteres. Depois de entrar, use "Esqueci minha senha" para trocar.
   - `CARGA_INICIAL_ATE`: o último dia da carga inicial, por exemplo duas semanas depois do lançamento (veja a seção 2).
   - `SMTP_URL` e `EMAIL_REMETENTE`: o servidor de e-mail (veja abaixo).
   - `OPERADOR_NOME`, `OPERADOR_CNPJ`, `OPERADOR_EMAIL`, `OPERADOR_FORO`: os dados da sua empresa, que aparecem nos termos de uso e na política de privacidade.
4. Confirme. O Render monta a imagem, cria o banco, roda as migrações e dá um endereço `https://preco-de-praca-xxxx.onrender.com`.
5. Abra `https://SEU-ENDERECO/saude`: deve responder `{"ok":true}`.

Planos: o blueprint usa o plano **Starter** no servidor (sempre ligado) e **Basic** no banco, cerca de US$ 7 + US$ 6 por mês. O plano gratuito do servidor hiberna depois de 15 minutos sem uso, e o banco gratuito expira depois de algumas semanas, o que não serve para um teste de várias semanas.

**E-mail.** O app envia lembretes de envio (segunda e terça), aviso de publicação (quarta) e o link de recuperação de senha. Use um serviço de envio transacional com SMTP, como Brevo, Resend, Amazon SES ou o SMTP do Google Workspace. Crie a conta, valide o domínio remetente (registros SPF e DKIM no DNS, o próprio serviço mostra quais) e preencha `SMTP_URL` no formato `smtps://usuario:senha@servidor:465`. Sem isso o app funciona, mas os e-mails só aparecem no log do servidor e a recuperação de senha fica pela administração.

Domínio próprio (opcional): em *Settings > Custom Domains* do serviço, aponte um subdomínio, como `app.seudominio.com.br`. O HTTPS é automático.

Outra hospedagem: qualquer serviço que rode Docker (Railway, Fly.io, AWS, um servidor próprio) funciona com o `Dockerfile`. Precisa de PostgreSQL 16 e das variáveis do `.env.example`, com `NODE_ENV=production`.

## 2. Preparar o teste

**Termos de uso e política de privacidade.** Antes de convidar o cliente, peça ao advogado para revisar `/termos` e `/privacidade` (os textos-base estão em `src/termos/`). O cadastro só é concluído com o aceite, e o sistema guarda a versão, a data e o IP. Se o texto mudar depois, troque `TERMOS_VERSAO`: todos precisarão aceitar de novo no próximo acesso.

**Carga inicial.** Com `CARGA_INICIAL_ATE` definido, até essa data os participantes podem enviar as notas das últimas 8 semanas (`CARGA_INICIAL_SEMANAS`), e nenhuma semana é publicada. No dia seguinte, todas as semanas saem de uma vez, e o painel já começa com histórico. Combine com os participantes de mandarem os XMLs antigos nesse período. Depois da carga inicial, vale a regra normal: só a semana corrente, até terça 23h59 da semana seguinte. As semanas são publicadas uma única vez, então notas que chegarem depois não alteram semanas já publicadas.

- Entre com o e-mail de administração e abra **Minha conta > Abrir administração** (ou `/admin.html`).
- Envie ao cliente o endereço e o código de convite.

**Atenção ao mínimo de 5 empresas.** Os preços de uma área só aparecem quando 5 ou mais empresas diferentes (raiz do CNPJ) enviaram notas daquela área naquela semana. Um único cliente, mesmo uma rede com muitos postos, conta como uma empresa e não vai ver números da região dele. Para o teste mostrar valor:

- convide pelo menos 5 empresas da mesma microrregião (ou do mesmo estado, onde o comparativo de distribuidoras também aparece); ou
- combine com o parceiro que, nas primeiras semanas, ele testa o envio e a validação das notas, e os números aparecem quando o grupo atingir o mínimo.

O cliente sempre vê o próprio preço na área "Sua posição".

## 3. O que o cliente faz

1. **Cadastro** com e-mail, senha, CNPJ do posto e o código de convite. O acesso de teste vale 30 dias.
2. **Rede de postos:** em *Minha conta*, adiciona os outros CNPJs. Cada nota vai para o posto do CNPJ destinatário.
3. **Toda semana**, até terça 23h59 da semana seguinte, envia os XML das NF-e de compra de gasolina, etanol, diesel S10 e S500. Pode arrastar vários arquivos de uma vez. Produto que não comprou, marca "Não comprei".
4. **Toda quarta**, a semana anterior é publicada e o painel mostra média, mediana e moda por região, estado, meso e microrregião.

Quem não completa a semana fica com o painel travado até completar a semana em aberto.

## 4. Integração com o sistema do cliente

Se o cliente quiser enviar as notas direto do ERP, ele cria uma chave em **Minha conta > Integração com o seu sistema**. A tela mostra os comandos. Resumo:

```bash
# enviar uma NF-e
curl -X POST https://SEU-ENDERECO/api/nfes \
  -H "Authorization: Bearer pp_..." -H "Content-Type: application/xml" \
  --data-binary @nota.xml

# semanas publicadas e painel
curl https://SEU-ENDERECO/api/semanas -H "Authorization: Bearer pp_..."
curl "https://SEU-ENDERECO/api/painel?semana=2026-10-12&produto=gc&nivel=uf&area=SP" -H "Authorization: Bearer pp_..."
```

Respostas do envio: `201` aceita ou em revisão, `422` recusada (o corpo traz o motivo de cada verificação), `409` nota já enviada, `400` arquivo que não é NF-e.

## 5. Durante o teste (administração)

- **Notas em revisão:** preço a mais de 15% da mediana da região, nota sem assinatura ou CFOP incomum. Aceite ou recuse; só as aceitas entram nas estatísticas.
- **Distribuidoras:** são criadas pelo CNPJ do emitente com a razão social da nota. Ajuste o nome que aparece no comparativo.
- **Senha esquecida:** o cliente usa "Esqueci minha senha" na tela de entrada. Se o e-mail não chegar, use "Gerar senha provisória" na linha do participante e passe a senha por telefone ou mensagem.
- **Termos:** a lista de participantes mostra quem aceitou e quando.
- **Acesso:** mude de "teste" para "ativa" para quem continuar depois dos 30 dias, ou "cancelada" para encerrar.

## 6. Antes de começar, confira

- [ ] `/saude` responde `{"ok":true}`.
- [ ] O log de subida **não** mostra o aviso "certificados da ICP-Brasil ausentes". Se mostrar, a assinatura das notas é conferida, mas a cadeia do certificado não; rode `npm run icp` no servidor ou refaça o deploy.
- [ ] Você consegue entrar como administrador.
- [ ] `/termos` e `/privacidade` mostram os dados da sua empresa (sem colchetes) e foram revisados pelo advogado.
- [ ] "Esqueci minha senha" com o seu e-mail faz o e-mail chegar (se não chegar, confira `SMTP_URL` e o log).
- [ ] `CARGA_INICIAL_ATE` está com a data combinada, e a tela de envio mostra o aviso da carga inicial.
- [ ] Um cadastro de teste sem o código de convite é recusado.
- [ ] Uma NF-e real de um posto parceiro é aceita (teste com uma nota da semana atual).
- [ ] O parceiro recebeu o aviso sobre o mínimo de 5 empresas e o parecer jurídico sobre troca de informações está encaminhado.
