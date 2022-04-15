# Guião - Vídeo Bake-Off 2

Foi-nos proposta a implementação de alterações a uma interface abstrata, com vista a diminuir o tempo de seleção de alvos fora do alcance do utilizador. Inicialmente, tinhamos uma interface como a que se segue:

<!-- imagem a passar -->

Consistia numa grelha de alvos 6x3, com uma área de input à qual o utilizador devia recorrer para acertar nos alvos a selecionar.

Pudemos logo observar pontos claros onde alterações surtiriam efeitos muito positivos:

<!-- as imagens relativas a cada feature devem estar a passar, bem como stats ig -->

- O alvo **a selecionar** praticamente não se distinguia dos restantes. Assim sendo, optámos por adicionar uma cor que criasse contraste, vermelho, a par de um rebordo que chamasse a atenção (amarelo).

- O alvo **seguinte** devia também contrastar com os demais alvos, por forma a dar ao utilizador uma pista de onde ir a seguir. Acabámos por optar por alvos completamente brancos, para além de ter linhas auxiliares que o utilizador podia seguir para encontrar o alvo seguinte.

Posteriormente, fomos experimentado mais _features_:

- Experimentámos mini explosões de _partículas_ como pista visual para o utilizador saber que tinha acertado no alvo. Não surtiu grandes efeitos, pelo que acabou por ser removida. <!-- FIXME: vai ser removida?-->

- Na mesma lógica de pistas dadas ao utilizador de que acertou no último alvo, tentámos mudar o ecrã entre verde e vermelho, consoante acertasse ou não no alvo, bem como _pistas auditivas_. Ambas aparentaram ter efeitos positivos, pelo que as mantivemos até ao fim.

<!-- TODO: snapping (luís) -->

- Por fim, procurámos adicionar uma área de "instruções" para o utilizador no ecrã - não pareceu surtir grandes efeitos, por isso removê-mo-la.

No fim, o resultado final foi o seguinte:

<!-- passa-se uma attempt completa na versão final e listagem das features incluídas -->