# ControlGrama Flow

⚠️ IMPORTANTE — BANCO DE DADOS:
NÃO habilite, conecte ou provisione nenhum banco de dados nativo da Lovable (não use o botão de "Enable Database"/Supabase automático da própria Lovable). Eu vou configurar e conectar meu próprio projeto Supabase manualmente, depois, com minhas credenciais. 
Por enquanto, construa toda a interface (telas, componentes, navegação, formulários) usando dados mockados/estado local (mock data em arquivos JS/TS ou estado do React), deixando clara a estrutura de dados esperada (schemas/tipos) para que eu conecte ao meu Supabase posteriormente sem precisar refazer a interface.
Não crie tabelas, não rode migrations, não conecte nenhuma integração de banco de dados automaticamente.


Crie um aplicativo web (mobile-first, PWA) chamado "ControlGrama" — um sistema de gestão completo para uma empresa de prestação de serviços de roçagem/corte de grama para prefeitura, cobrindo Ponto, RH, Diárias e Financeiro.

CONTEXTO DO NEGÓCIO
- Empresa presta serviço de roçagem/corte de grama para a prefeitura (contrato de prestação de serviço).
- Equipe formada por diaristas (pagos por dia trabalhado) e, futuramente, contratados CLT (salário fixo).
- Diárias são pagas duas vezes por mês: no 5º dia útil (fecha o período anterior) e no dia 20 (adiantamento parcial do mês corrente).
- Empresa recebe da prefeitura por contrato/medição de serviço prestado.

MÓDULO 1 — GESTÃO DE FUNCIONÁRIOS (RH completo)
- Cadastro completo: nome, CPF, RG, telefone, endereço, foto, função (roçador, motorista, encarregado, etc.)
- Tipo de vínculo: Diarista ou Contratado (CLT)
- Diaristas: valor da diária
- Contratados: salário, data de admissão, cargo, carga horária, benefícios (vale-transporte, vale-alimentação), férias e 13º (datas e status)
- Documentos: upload de CNH, ASO (atestado de saúde ocupacional), comprovante de endereço, contrato assinado
- Status do funcionário: ativo, afastado, desligado (com data e motivo do desligamento)
- Histórico de eventos: advertências, promoções, mudança de função
- Alertas automáticos: ASO vencendo, CNH vencendo, férias vencendo

MÓDULO 2 — CONTROLE DE PONTO
- Tela de "chamada do dia": lista de trabalhadores com toggle Presente/Falta/Falta justificada/Atestado
- Registro por data, com campo de observação (local/frente de serviço)
- Histórico de presença por trabalhador e por período
- Resumo mensal de dias trabalhados, faltas e faltas justificadas por trabalhador

MÓDULO 3 — DIÁRIAS E FOLHA DE PAGAMENTO
- Cálculo automático: dias trabalhados x valor da diária (diaristas) / cálculo proporcional (contratados)
- Dois ciclos de pagamento mensais, configuráveis:
  a) 5º dia útil do mês (calculado automaticamente, pulando fins de semana e feriados nacionais) → fecha diárias do período anterior
  b) Dia 20 → fecha período parcial do mês corrente (adiantamento)
- Tela de fechamento de pagamento: por trabalhador, dias trabalhados, valor total, status (pendente/pago)
- Marcar como pago: data, forma de pagamento (Pix, dinheiro, transferência), comprovante anexado
- Histórico de pagamentos por trabalhador

MÓDULO 4 — FINANCEIRO COMPLETO
- Contas a receber: vinculadas aos contratos/medições com a prefeitura (número do contrato, período de referência, valor previsto, data prevista de recebimento, status pendente/recebido, empenho/nota de empenho se aplicável)
- Contas a pagar: pagamento de diárias/salários (integrado ao Módulo 3), fornecedores (combustível, manutenção de máquinas, peças, EPIs), impostos e taxas
- Fluxo de caixa: entradas e saídas por período, saldo projetado e saldo real, gráfico de fluxo de caixa mensal
- Categorias de despesa: combustível, manutenção de equipamentos (roçadeiras, cortadores), mão de obra, EPIs, impostos, administrativo
- Centro de custo opcional por frente de serviço/contrato (para saber a rentabilidade de cada contrato com a prefeitura)
- Emissão/registro de notas fiscais de serviço emitidas para a prefeitura (número, valor, data, status)
- Relatório de DRE simplificado (receitas - despesas = resultado) por mês
- Dashboard financeiro: saldo atual, a receber no mês, a pagar no mês, resultado do mês, gráfico de evolução

DASHBOARD GERAL (tela inicial)
- Total de funcionários ativos (diaristas + contratados)
- Presença do dia
- Próxima data de pagamento de diárias (contagem regressiva) e valor total a pagar
- Contas a receber da prefeitura em aberto
- Saldo de caixa atual
- Alertas: documentos vencendo, faltas recorrentes, contas a vencer

RELATÓRIOS E EXPORTAÇÃO
- Folha de ponto mensal (PDF/Excel)
- Relatório de pagamentos de diárias por período
- Relatório financeiro (receitas x despesas) por período, exportável
- Relatório por contrato/frente de serviço da prefeitura

REQUISITOS TÉCNICOS
- Mobile-first, PWA, uso no campo (poucos toques para marcar ponto)
- Supabase para banco de dados e autenticação, com perfis de acesso: Admin (você) e Encarregado (acesso limitado, só marca ponto)
- Estrutura de dados sugerida:
  - workers (funcionários: dados, tipo de vínculo, valores, documentos)
  - attendance (ponto diário)
  - payment_periods e payments (diárias/folha)
  - contracts (contratos com a prefeitura)
  - receivables (contas a receber, vinculadas a contracts)
  - payables (contas a pagar, incluindo payments do módulo de diárias)
  - expenses_categories (categorias de despesa)
  - cash_flow (visão consolidada, pode ser view/query, não tabela)
- Cores: tons de verde (remetendo à grama) com cinza neutro, visual limpo e profissional
- Priorize: 1) tela de ponto rápida, 2) dashboard, 3) financeiro, 4) RH, 5) relatórios — nessa ordem de construção

NÃO comece pelo banco de dados. Comece construindo a interface completa (dashboard, ponto, RH, financeiro) com dados mockados/estado local, seguindo a estrutura de dados sugerida acima apenas como referência de schema (não como tabelas reais). A conexão com banco de dados (meu próprio Supabase) será feita por mim posteriormente, em uma etapa separada.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/af5d3467-4bc0-4836-9ab7-baf2c51642e9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
