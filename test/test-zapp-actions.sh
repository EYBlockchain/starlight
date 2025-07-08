cd temp-zapps/
echo “$(tput setaf 3) SHIELDCONTRACTS”
SOLFILES=$(find . -type f -name "*Shield*.sol" -maxdepth 3 -mindepth 3)
solarray=($SOLFILES)
for solelement in "${solarray[@]}"
do
    DIR="$(dirname "${solelement}")"
    solelement="${solelement:2}"
    echo “$(tput setaf 7) $solelement compiling”
    solcjs --abi -o $DIR --include-path node_modules/ --base-path . $solelement || { echo “$(tput setaf 1) $solelement failed” && exit 1 ;}
done

echo “$(tput setaf 3) CIRCUITS”
ZOKFILES=$(find . -type f -name "*.zok" -maxdepth 3 -mindepth 3)
zokarray=($ZOKFILES)
for zokelement in "${zokarray[@]}"
do
    zokelement="${zokelement:1}"
    echo “$(tput setaf 7) $zokelement compiling”
    docker run -t -v $PWD:/home/zokrates/code --name=testcircuits zokrates/zokrates:0.8.8 .zokrates/bin/zokrates compile -i code$zokelement || { echo “$(tput setaf 1) $zokelement failed” && exit 1 ;}
    docker rm testcircuits
done
