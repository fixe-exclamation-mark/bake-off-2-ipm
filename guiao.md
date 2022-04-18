# Guião - Vídeo Bake-Off 2

Foi-nos proposta a implementação de alterações a uma interface abstrata, com vista a diminuir o tempo de seleção de alvos fora do alcance do utilizador. Inicialmente, tinhamos uma interface como a que se segue:

<!-- imagem a passar -->

Consistia numa grelha de alvos 6x3, com uma área de input à qual o utilizador devia recorrer para acertar nos alvos a selecionar.

Pudemos logo observar pontos claros onde alterações surtiriam efeitos muito positivos:

<!-- as imagens relativas a cada feature devem estar a passar, bem como stats ig -->

- O alvo **a selecionar** praticamente não se distinguia dos restantes. Assim sendo, optámos por adicionar uma cor que criasse contraste, vermelho, a par de um rebordo que chamasse a atenção (amarelo).

- O alvo **seguinte** devia também contrastar com os demais alvos, por forma a dar ao utilizador uma pista de onde ir a seguir. Acabámos por optar por alvos auxiliares completamente brancos, que aparentaram distinguir-se bem dos restantes.

<!-- todo - next_target_dim_color - feature removida -->

Posteriormente, fomos experimentado mais _features_:

- Experimentámos um leque de pistas para o utilizador: mini-explosões de partículas, mudança da cor de fundo entre verde e vermelho, alteração da cor e rebordo do alvo caso vá ter de ser clicado duas vezes e, no fim, feedback auditivo. Destas tentativas, a que pareceu surtir um menor _boost_ na prática foi a utilização de partículas, mas ainda assim optámos por mantê-las. O feedback auditivo e a mudança da cor de fundo foram dos que mais se fizeram sentir.

- Procurámos adicionar linhas auxiliares para o utilizador saber para onde tem de mover o cursor - a _feature_ foi bem recebida, pelo que acabámos por mantê-la.

- Já perto do fim, implementámos _target snapping_, que teve o maior impacto de todos no desempenho dos utilizadoes. Aqui, o utilizador continua a ter controlo total do cursor, no entanto, um segundo cursor virtual é colocado no topo do alvo mais próximo, selecionando-o. Para facilitar a compreensão da _feature_ anterior, alterámos visualmente a área de input, revelando as regiões que levarão à seleção de cada alvo.

- Adicionámos ainda um ecrã de "instruções" para ajudar o utilizador a saber onde clicar antes de começar. Acabou por não fazer grande diferença no resultado final.
  
- No final, adicionámos uma _time bar_, com o objetivo de criar uma "pressão adicional" aos utilizadores, fazendo-os em teoria ser mais rápidos. Verificaram-se, contudo, mais erros devido à pressão, pelo que a ideia foi posta de lado.

No fim, o resultado final foi o seguinte:

<!-- passa-se uma attempt completa na versão final e listagem das features incluídas -->
