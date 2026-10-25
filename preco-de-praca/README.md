# Preço de Praça

Postos compartilham toda semana o preço que pagam às distribuidoras (gasolina C, etanol hidratado, diesel S10 e S500), comprovado pela NF-e de compra. Em troca, veem média, mediana e moda por região e o comparativo entre distribuidoras.

Para colocar no ar e conduzir o teste com um cliente parceiro, veja o [GUIA-PILOTO.md](GUIA-PILOTO.md).

## Rodar localmente

Requisitos: Node 22+ e PostgreSQL 16 (ou Docker).

```bash
docker compose up -d          # PostgreSQL com os bancos precodepraca e precodepraca_test
npm install
cp .env.example .env          # ajuste se precisar
npm run demo                  # opcional: dados FICTÍCIOS de demonstração
DEMO=1 npm run dev            # http://localhost:3000 (DEMO não funciona com NODE_ENV=production)
```

Com os dados de demonstração, entre com `demo@precodepraca.dev` / `demo1234`. Com `DEMO=1`, a tela de envio oferece NF-e de exemplo assinadas com um certificado de teste.

```bash
npm test                      # testes (precisam do banco precodepraca_test)
npm run typecheck
```

## Regras do produto

| Regra | Onde está |
|---|---|
| Semana de segunda a domingo; NF aceita até terça 23h59 da semana seguinte (`PRAZO_DIAS`) | `src/dominio/semanas.ts` |
| A semana é calculada e publicada uma única vez, depois do prazo | `src/estatistica/fechamento.ts` |
| Painel liberado para quem completou a semana publicada ou a semana em aberto (os 4 produtos, ou "não comprei" por até 2 semanas seguidas) | `src/acesso.ts` |
| Localização do posto pelo `cMun` do destinatário da primeira NF-e aceita; notas de outro município são recusadas | `src/nfe/validacao.ts` |
| Cada empresa (raiz do CNPJ) conta uma vez por produto e semana, com média ponderada pelo volume | `src/estatistica/fechamento.ts` |
| Rede com vários postos: cada CNPJ é um posto da conta; a nota vai para o posto do CNPJ destinatário | `src/rotas/nfe.ts` |

## Sigilo (risco concorrencial)

Implementado em `src/estatistica/sigilo.ts` e testado em `test/sigilo.test.ts`.

- **Sem município.** Áreas publicadas: Brasil, região, UF, mesorregião e microrregião do IBGE.
- **Só média, mediana e moda.** Mínima e máxima não são calculadas nem guardadas: seriam o preço efetivo de uma única empresa.
- **Mínimo de 5 empresas** distintas (raiz do CNPJ) por célula (área × produto × semana × distribuidora), configurável em `K_MINIMO`. Uma rede com vários postos conta como uma.
- **Distribuidoras só de UF para cima.** Em meso e microrregião sai apenas o total.
- **Proteção contra subtração.** Se uma área aberta menos as subáreas (ou distribuidoras) abertas dentro dela deixasse de 1 a 4 postos, o sistema fecha mais uma célula. O teste ataca o resultado com famílias aleatórias de células para conferir.
- **Quantidade de postos em faixas** nas áreas abertas (5 a 9, 10 a 19…), para que média × quantidade não dê a soma exata.
- **Só semanas fechadas.** Ninguém vê o número mudar quando um novo posto envia.

Ponto para o parecer jurídico: com número ímpar de empresas, a mediana coincide com o preço de uma delas (sem dizer qual). Se o advogado pedir, dá para arredondar a mediana ao centavo ou aumentar `K_MINIMO`.

## Validação da NF-e

`src/nfe/`: lê o XML (modelo 55), confere a chave de acesso (dígito verificador), o destinatário igual ao CNPJ do posto, a data dentro do prazo, CFOP de revenda (5652/6652/5655/6655), produto pelo código ANP (`cProdANP`), conversão de m³ para litro e faixa de preço.

A **assinatura digital** é verificada (XMLDSig, RSA-SHA1/C14N como a SEFAZ usa): preço alterado depois da emissão faz a nota ser recusada. Os dados são lidos do trecho assinado. O certificado precisa ser da empresa emitente. Para validar a cadeia até a ICP-Brasil, `npm run icp` baixa os certificados das ACs do site do ITI para `data/icp-brasil/` (a imagem Docker já faz isso). Com eles, nota assinada por certificado fora da ICP-Brasil vai para revisão. Sem eles, o sistema avisa que a cadeia não foi verificada.

Notas sem assinatura, com preço a mais de 15% da mediana da região ou CFOP incomum vão para **revisão manual** (`/api/admin/revisao`).

## Próximos passos

- Pagamento recorrente (gateway com Pix e cartão). Hoje o posto começa com teste de 30 dias e a administração muda o acesso manualmente.
- Recuperação de senha por e-mail. Hoje a administração gera uma senha provisória.
- Consulta da chave na SEFAZ (situação autorizada/cancelada), que exige o certificado A1 da empresa.
- Leitura de foto/PDF do DANFE com IA, extraindo a chave e conferindo na SEFAZ.
- Captura automática das notas pelo serviço de Distribuição de DF-e, com o certificado do posto.
- Conferir na base de revendedores da ANP que o CNPJ é um posto autorizado.

## Dados geográficos

`data/municipios-ibge.json`: 5.567 municípios com mesorregião (137) e microrregião (558) da Divisão Territorial Brasileira do IBGE, extraídos do pacote npm `ibge-cidades-com-poligonos`. Faltam 3 municípios criados depois dessa base. O IBGE substituiu meso e microrregiões pelas regiões geográficas intermediárias e imediatas em 2017; a troca exige só outra tabela de-para.
