# Assistente Pessoal de Monitoramento de Compras — Escopo Técnico Funcional

| Campo | Valor |
|---|---|
| Projeto | Assistente Pessoal de Monitoramento de Compras |
| Versão | 2.1 |
| Data | 12/11/2026 |
| Elaborado por | Agent (Governador), em entrevista com sledt1006p01@imersao.mitralab.io |
| Status | Escopo completo |

## 2. Objetivo

O Assistente Pessoal de Monitoramento de Compras acompanha o preço de produtos que o usuário quer comprar. O usuário cadastra cada produto enviando o link dele. A partir daí, o assistente procura esse produto em diferentes lojas, em sistemas de busca e em sites pré-determinados pelo usuário, e registra o preço encontrado em cada lugar.

Além do produto exato, o assistente pode procurar produtos similares. Essa busca é uma opção que o usuário liga ou desliga para cada produto. A verificação roda de hora em hora, com atenção especial ao período de Black Friday.

Quando o preço de um produto fica baixo, o assistente notifica o usuário. Para decidir se o preço está baixo, ele compara o valor encontrado com referências de preço do mesmo produto disponíveis na internet. Com isso, o usuário não precisa visitar as lojas manualmente e fica sabendo da oportunidade enquanto ela está disponível.

## 3. Atores e personas

| Persona | Responsabilidade | Interação com o sistema |
|---|---|---|
| Usuário comprador (hoje, o único usuário) | Decidir o que quer comprar e quando comprar | Envia o link de cada produto pela conversa, liga ou desliga a busca de similares, mantém a lista de lojas fixas e recebe as notificações de preço baixo na própria conversa |
| Assistente de monitoramento (agente) | Procurar o produto e os similares, registrar preços e condições, tirar print das páginas, montar a referência de preço e avisar quando o preço está baixo | Roda sozinho de hora em hora nas lojas fixas e na busca aberta na web, e escreve a notificação na conversa do usuário |

Por enquanto o sistema tem um único usuário. Uso por outras pessoas fica para depois (ver Pontos em aberto).

## 4. Pré-condições

| ID | Descrição | Tipo |
|---|---|---|
| PC-01 | O produto é cadastrado a partir de um link de página de produto enviado pelo usuário na conversa | Obrigatória |
| PC-02 | Existe a lista fixa de lojas consultadas em toda rodada: Amazon, Mercado Livre, Magalu, Kabum, Google Shopping, Buscapé, Zoom, Angeloni, Bistek, Carrefour, Droga Raia, Panvel e Preço Popular | Obrigatória |
| PC-03 | O usuário pode acrescentar lojas à lista fixa pela conversa | Obrigatória |
| PC-04 | O assistente tem acesso à internet para abrir as páginas das lojas, fazer busca aberta na web e tirar print das páginas | Obrigatória |
| PC-05 | O assistente consegue rodar sozinho de hora em hora, sem o usuário pedir | Obrigatória |
| PC-06 | Há uma fonte de histórico de preço dos últimos meses (como o Buscapé mostra) ou o próprio sistema acumula o histórico das suas buscas | Desejável |

## 5. Glossário

| Termo | Definição |
|---|---|
| Produto monitorado | Produto que o usuário cadastrou por link e que o assistente acompanha de hora em hora |
| Link de origem | O endereço da página do produto enviado pelo usuário no cadastro |
| Preço "De" | Preço cheio mostrado na página antes do desconto (ex.: R$ 4.499,00); nunca entra no cálculo |
| Preço "Por" | Preço final com desconto (ex.: R$ 2.799,00) |
| Preço comparado | Preço "Por" mais o frete (frete zero quando há frete grátis acima de um valor e o produto passa dele) |
| Valor de mercado | Média dos preços comparados do mesmo produto nas lojas na rodada; é a base do desconto |
| Faixa de oportunidade | Classificação da oferta pelo desconto: Imperdível, Ótima ou Boa oportunidade |
| Condições | Forma de pagamento e extras mostrados junto com o preço: à vista, Pix, parcelas, cupom, frete |
| Lista fixa de lojas | Lojas consultadas em toda rodada, mantida pelo usuário |
| Busca aberta | Procura do produto na web fora da lista fixa |
| Variação | O mesmo produto, da mesma marca e linha, mudando só um atributo como sabor, cor ou embalagem (ex.: ração Biofresh sabor salmão e sabor frango) |
| Similar | Produto semelhante de outra marca, buscado só quando a opção está ligada |
| Vendedor terceiro | Vendedor que anuncia dentro de um marketplace (ex.: Mercado Livre, Amazon) e não é a própria loja |
| Recondicionado | Produto revisado e revendido; entra na busca, identificado no aviso |
| Rodada | Uma execução completa da busca para um produto, de hora em hora |
| Histórico de preço | Preços do produto nos últimos meses, como o Buscapé mostra; informação de apoio no aviso |
| Print | Captura da página da loja mostrando o preço, guardada como prova |
| Notificação | Aviso na conversa do usuário quando um preço baixo é encontrado |
| Lembrete diário | Repetição do aviso uma vez por dia, no horário escolhido pelo usuário, enquanto a oferta continua |

## 6. Regras de negócio

**RN-01 — Cadastro por link.** Um produto entra no monitoramento quando o usuário envia o link da página dele na conversa. Desse link o assistente lê o nome do produto, o preço "De" (cheio) e o preço "Por" (com desconto), quando existirem.
Exemplo: link da Oster da Cafeteira Espresso Digital Superautomática com Moedor Cônico Inox, com "De: R$ 4.499,00" e "Por: R$ 2.799,00". O produto é cadastrado com preço de partida R$ 2.799,00.

**RN-02 — Preço considerado é o com desconto.** Em toda loja, o preço que vale é o preço final com desconto (o "Por"). O preço "De" é registrado só como informação e nunca entra no cálculo do desconto, porque as lojas costumam inflá-lo.
Exemplo: De R$ 4.499,00 / Por R$ 2.799,00 → o preço considerado é R$ 2.799,00.

**RN-03 — Condições junto com o preço.** Junto com cada preço, o assistente registra as condições mostradas na página (à vista, Pix, parcelado, cupom, frete) quando estiverem visíveis.

**RN-04 — Print como prova.** Em cada loja onde encontrar o produto, o assistente tira um print da página mostrando o preço e o guarda junto com o registro daquela busca.

**RN-05 — Onde procurar.** Em cada rodada, o assistente procura o produto em todas as lojas da lista fixa (PC-02) e também numa busca aberta na web, que pode trazer lojas fora da lista.

**RN-06 — Variação é o mesmo produto.** Variação é o mesmo produto, da mesma marca e linha, mudando só um atributo como sabor, cor ou tamanho de embalagem. A variação entra na busca do produto exato, conta como o mesmo produto e aparece identificada no aviso (ex.: "variação: sabor frango").
Exemplo: o usuário cadastra a ração Biofresh para gato castrado sabor salmão. A mesma ração Biofresh para gato castrado sabor frango é uma variação e entra na busca do produto exato.

**RN-07 — Similares são de outras marcas.** Similar é um produto semelhante de outra marca. A busca de similares é uma opção ligada ou desligada por produto. Ligada, ela roda em paralelo à busca do produto exato e traz até 3 similares por produto em cada rodada, cada um identificado como "similar" no aviso.
Exemplo: para a ração Biofresh para gato castrado, até 3 rações para gato castrado de outras marcas.

**RN-08 — Frequência.** A busca roda de hora em hora para todo produto em monitoramento, com atenção especial ao período de Black Friday.

**RN-09 — Frete entra no preço comparado.** O preço comparado entre lojas é o preço com desconto mais o frete. Se a loja dá frete grátis acima de um valor e o produto passa desse valor, o frete conta como zero.
Exemplo: Loja A vende por R$ 2.799,00 com frete de R$ 49,90 → preço comparado R$ 2.848,90. Loja B vende por R$ 2.820,00 com frete grátis acima de R$ 199,00 → preço comparado R$ 2.820,00. A Loja B é a mais barata.

**RN-10 — Valor de mercado (base do desconto).** A base do desconto é o valor de mercado: a média dos preços comparados (RN-09) do mesmo produto encontrados nas lojas na rodada. O histórico dos últimos meses (como o Buscapé mostra) não muda o cálculo; ele aparece no aviso como informação de apoio (ex.: "menor preço dos últimos meses").
Exemplo: o produto aparece a R$ 3.900,00, R$ 4.050,00 e R$ 4.050,00 em três lojas → valor de mercado R$ 4.000,00.

**RN-11 — Faixas de oportunidade.** Desconto = (valor de mercado − preço comparado) ÷ valor de mercado. A oferta é classificada nestas faixas padrão:

| Faixa | Desconto |
|---|---|
| Imperdível | 50% ou mais |
| Ótima oportunidade | de 30% até menos de 50% |
| Boa oportunidade | de 20% até menos de 30% |

Abaixo de 20% de desconto, a oferta não gera aviso. O usuário pode mudar os limites e os nomes das faixas.
Exemplo: valor de mercado R$ 4.000,00 e preço comparado R$ 2.799,00 → desconto de 30,0% → Ótima oportunidade. Com preço comparado R$ 3.150,00 → desconto de 21,3% → Boa oportunidade.

**RN-12 — Primeiro aviso.** Quando uma oferta entra numa faixa (RN-11), o assistente avisa o usuário na própria conversa, com o produto, a loja, a faixa, o preço com desconto, o frete, as condições, o print, o valor de mercado e o histórico de apoio.

**RN-13 — Lembrete diário em horário do usuário.** Enquanto a oferta continuar numa faixa, o assistente lembra o usuário uma vez por dia, no horário que o próprio usuário define. Nas rodadas de hora em hora entre um lembrete e outro ele não repete o aviso.
Exemplo: o usuário define 20h → o lembrete sai todo dia às 20h, horário de Brasília.

**RN-14 — Aviso quando o preço baixa mais.** Se, durante o período da oferta, o preço comparado cair ainda mais ou a oferta subir de faixa, o assistente avisa na hora, sem esperar o lembrete diário, mostrando o preço anterior e o novo.
Exemplo: avisou a R$ 2.799,00; na rodada seguinte está a R$ 2.599,00 → novo aviso imediato.

**RN-15 — Oportunidade perdida.** Se o preço voltar a subir e a oferta sair de todas as faixas, o assistente avisa que a oportunidade foi perdida e pergunta se o usuário quer continuar monitorando até o preço baixar de novo. Sim: o monitoramento continua. Não: o produto sai do monitoramento.

**RN-16 — Estado do produto.** Produto novo e recondicionado entram na busca; o recondicionado aparece sempre identificado como "recondicionado" no aviso. Produto usado fica de fora por padrão. Cada produto tem uma opção para incluir usados, que o usuário liga quando quiser.

**RN-17 — Vendedor terceiro.** Anúncio de vendedor terceiro em marketplace (ex.: Mercado Livre, Amazon) entra na busca e na comparação, e aparece identificado como "vendedor terceiro" no aviso.

**RN-18 — Fim do monitoramento.** O monitoramento de um produto só termina quando o usuário cancela (opção de cancelar a qualquer momento) ou quando chega a data de fim, se o usuário definiu uma para aquele produto. A data de fim é opcional e por produto. Terminado, o produto sai das rodadas e não gera mais aviso nem lembrete; o histórico já registrado fica guardado.
Exemplo: o usuário define 01/12 como data de fim da cafeteira Oster → a última rodada dela é em 01/12.

**RN-19 — Tela de histórico.** Além dos avisos na conversa, há uma tela simples com a lista de produtos monitorados e, para cada um, os preços por loja da última rodada e o gráfico do histórico de preço.

**RN-20 — Um único usuário.** Nesta versão o sistema tem um único usuário, com a sua lista de produtos e de lojas. O uso por outras pessoas fica fora desta versão.

## 7. Fluxo principal (caminho feliz)

| Passo | Descrição |
|---|---|
| 1 | O usuário envia na conversa o link de um produto (ex.: a cafeteira Oster) |
| 2 | O assistente abre a página, lê o nome, o preço "De", o preço "Por" e as condições, e tira o print |
| 3 | O assistente confirma o cadastro na conversa e pergunta se a busca de similares fica ligada para esse produto |
| 4 | De hora em hora, o assistente procura o produto nas 13 lojas da lista fixa e na busca aberta na web (e os similares, se ligados) |
| 5 | Em cada loja onde encontra o produto, registra o preço com desconto, o frete, as condições e o print |
| 6 | Calcula o preço comparado de cada loja (preço com desconto + frete) |
| 7 | Monta a referência de preço com a média das outras lojas e o histórico dos últimos meses |
| 8 | Calcula o desconto de cada oferta contra a referência e a classifica numa faixa (Imperdível, Ótima ou Boa oportunidade) |
| 9 | Se uma oferta entra numa faixa, avisa o usuário na conversa com loja, faixa, preço, frete, condições, print e comparação |
| 10 | Enquanto a oferta continua na faixa, lembra o usuário uma vez por dia |
| 11 | Se o preço cair mais, avisa na hora com o preço anterior e o novo |
| 12 | O usuário decide comprar fora do sistema, a partir do aviso |

## 8. Fluxos alternativos e exceções

| ID | Cenário | Comportamento esperado |
|---|---|---|
| FA-01 | O preço volta a subir e a oferta sai de todas as faixas | O assistente avisa que a oportunidade foi perdida e pergunta se o usuário quer continuar monitorando até baixar de novo |
| FA-02 | O usuário responde que quer continuar monitorando | O produto segue nas rodadas de hora em hora e volta a avisar quando entrar numa faixa |
| FA-03 | O usuário responde que não quer continuar | O produto sai do monitoramento |
| FA-04 | O preço cai ainda mais durante a oferta | Aviso imediato com o preço anterior e o novo, sem esperar o lembrete diário |
| FA-05 | A oferta muda de faixa (ex.: de Boa para Ótima oportunidade) | Novo aviso imediato informando a nova faixa |
| FA-06 | A loja tem frete grátis acima de um valor e o produto passa desse valor | O frete conta como zero no preço comparado |
| FA-07 | O desconto fica abaixo de 20% | Nenhum aviso; o preço só é registrado no histórico |
| FA-08 | O usuário muda os limites ou os nomes das faixas | As rodadas seguintes passam a classificar com as faixas novas |
| FA-09 | A oferta encontrada é de produto recondicionado | Entra na comparação e o aviso mostra "recondicionado" |
| FA-10 | A oferta encontrada é de produto usado | Fica de fora, a não ser que a opção de incluir usados esteja ligada naquele produto |
| FA-11 | O usuário cancela o monitoramento de um produto | O produto sai das rodadas e não gera mais aviso nem lembrete; o histórico fica guardado |
| FA-12 | A oferta encontrada é uma variação do produto (outro sabor, cor ou embalagem) | Conta como o mesmo produto e o aviso mostra a variação (ex.: "variação: sabor frango") |
| FA-13 | A oferta encontrada é de vendedor terceiro em marketplace | Entra na comparação e o aviso mostra "vendedor terceiro" |
| FA-14 | O usuário muda o horário do lembrete diário | O próximo lembrete já sai no horário novo |
| FA-15 | Chega a data de fim definida para um produto | O produto sai das rodadas e o assistente avisa na conversa que o monitoramento dele terminou; o histórico fica guardado |
| FA-16 | A busca de similares encontra mais de 3 produtos de outras marcas | O assistente traz só 3 similares |

## 9. Critérios de aceite

| ID | Critério |
|---|---|
| CA-01 | Ao enviar o link da cafeteira Oster, o produto é cadastrado com nome, preço "De" R$ 4.499,00 e preço "Por" R$ 2.799,00 |
| CA-02 | Toda rodada consulta as 13 lojas da lista fixa e a busca aberta na web |
| CA-03 | Uma loja acrescentada pelo usuário à lista fixa passa a ser consultada na rodada seguinte |
| CA-04 | As rodadas acontecem de hora em hora sem o usuário pedir |
| CA-05 | Cada preço encontrado tem print da página, condições e frete registrados |
| CA-06 | O preço comparado soma o frete, e o frete conta zero quando a loja dá frete grátis acima de um valor e o produto passa dele |
| CA-07 | Com preços comparados de R$ 3.900,00, R$ 4.050,00 e R$ 4.050,00, o valor de mercado é R$ 4.000,00 |
| CA-08 | O preço "De" nunca entra no cálculo do desconto |
| CA-09 | Valor de mercado R$ 4.000,00 e preço R$ 2.799,00 classifica como Ótima oportunidade (30,0%); R$ 3.150,00 como Boa oportunidade (21,3%); R$ 2.000,00 como Imperdível (50%) |
| CA-10 | Desconto abaixo de 20% não gera aviso |
| CA-11 | O primeiro aviso chega na conversa com produto, loja, faixa, preço, frete, condições, print, valor de mercado e histórico |
| CA-12 | Com a oferta mantida na mesma faixa e sem queda de preço, sai um lembrete por dia, no horário definido pelo usuário, e nenhum aviso entre um e outro |
| CA-13 | Queda de preço ou subida de faixa durante a oferta gera aviso imediato com preço anterior e novo |
| CA-14 | Quando a oferta sai de todas as faixas, chega o aviso de oportunidade perdida com a pergunta de continuar ou não |
| CA-15 | Respondendo "não" ao aviso de oportunidade perdida, ou usando a opção de cancelar, o produto deixa de ser buscado e não gera mais aviso |
| CA-16 | Oferta recondicionada aparece no aviso marcada como "recondicionado" |
| CA-17 | Oferta de usado não aparece, a menos que a opção de incluir usados esteja ligada no produto |
| CA-18 | Mudar os limites ou nomes das faixas vale a partir da rodada seguinte |
| CA-19 | Com a busca de similares ligada, a rodada traz no máximo 3 produtos semelhantes de outras marcas, marcados como "similar"; desligada, não traz nenhum |
| CA-20 | Cadastrada a ração Biofresh para gato castrado sabor salmão, a oferta do sabor frango aparece como o mesmo produto, marcada como variação |
| CA-21 | Oferta de vendedor terceiro no Mercado Livre ou na Amazon aparece no aviso marcada como "vendedor terceiro" |
| CA-22 | Mudando o horário do lembrete para 20h, o lembrete seguinte sai às 20h |
| CA-23 | Com data de fim 01/12 num produto, não há rodada nem aviso dele depois de 01/12; sem data de fim, ele segue até ser cancelado |
| CA-24 | A tela de histórico lista os produtos monitorados com os preços por loja da última rodada e o gráfico do histórico de cada um |

## 10. Pontos em aberto

Nenhum ponto em aberto nesta versão. As decisões tomadas para os últimos pontos estão nas regras: até 3 similares por produto (RN-07), fim por cancelamento ou por data de fim opcional (RN-18), tela de histórico (RN-19) e um único usuário (RN-20).

