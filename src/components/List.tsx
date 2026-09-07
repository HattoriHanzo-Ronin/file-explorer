import { FlatList } from "react-native";
import { DirContent, useAppContext } from "./AppContextProvider";
import ContentCard from "./ContentCard";

export default function (props: {
    dirContent: DirContent[], doubleTapAction: (name: string, type: string) => void, longPressAction: (name: string, type: string) => void,
    oneTapAction: (name: string, type: string) => void, notSelectable: boolean
}) {
    const ITEM_SIZE = 100, context = useAppContext()

    return (<FlatList data={props.dirContent}
        // diciendole el tamaño fijo evita que tenga que medir los elemnentos todo el rato 
        getItemLayout={(data, index) => ({
            length: ITEM_SIZE,
            offset: ITEM_SIZE * index,
            index,
        })}
        // la cantidad de items que va a renderizar en la primera carga
        initialNumToRender={12}
        // elimina del render los que no se ven en la pantalla
        removeClippedSubviews
        // hace grid
        numColumns={3}
        renderItem={it => {
            const name = it.item.name, type = it.item.type
            return <ContentCard content={it.item}
                // cuando se aprete 2 veces
                doubleTapAction={() => props.doubleTapAction(name, type)}
                // en un press largo
                longPressAction={() => props.longPressAction(name, type)}
                // un solo press
                oneTapAction={() => props.oneTapAction(name, type)}
                notSelectable={props.notSelectable || (context.lastLocalDir === "Android" && (name === "data" || name === "obb"))}
            />
        }}
        keyExtractor={(it, ind) => `${it.name}${ind}`} />)
}