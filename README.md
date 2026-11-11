# Fluxo — seu dinheiro em movimento

App financeiro (PWA) que funciona no celular e no computador, sem instalar nada e sem servidor: os dados ficam salvos no próprio aparelho.

## Telas
- **Início** — registre ganhos e gastos. O *Orbe* mostra quanto sobra do mês (líquido que sobe e desce) e quanto você pode gastar hoje.
- **Cartões** — informe só o nome do banco/bandeira e o app cria o cartão fictício; acompanhe os gastos de cada um por mês.
- **Metas** — guarde para uma viagem ou compra específica, com progresso e quanto guardar por mês até o prazo.
- **Parcelas** — parcelamentos e financiamentos com linha do tempo; dê baixa em cada parcela conforme os meses passam.

## Rodar
```bash
cd fluxo && python3 -m http.server 8080   # abra http://localhost:8080
```
No celular, abra o endereço (HTTPS) e use "Adicionar à tela inicial" para instalar como app. Em Ajustes há backup/restauração e dados de exemplo.
