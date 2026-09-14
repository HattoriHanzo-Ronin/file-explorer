import { FlatList } from "react-native";
import { DirContent, useAppContext } from "./AppContextProvider";
import ContentCard from "./ContentCard";

export default function List(props: {
    dirContent: DirContent[];
    doubleTapAction: (name: string, type: DirContent["type"]) => void;
    longPressAction: (name: string, type: DirContent["type"]) => void;
    oneTapAction: (name: string, type: DirContent["type"]) => void;
    notSelectable: boolean;
}) {
    const { dirContent, doubleTapAction, longPressAction, oneTapAction, notSelectable } = props;
    const ITEM_SIZE = 100;
    const context = useAppContext();

    return (
        <FlatList
            data={dirContent}
            getItemLayout={(data, index) => ({
                length: ITEM_SIZE,
                offset: ITEM_SIZE * index,
                index
            })}
            initialNumToRender={12}
            removeClippedSubviews
            numColumns={3}
            renderItem={(it) => {
                const name = it.item.name;
                const type = it.item.type;
                return (
                    <ContentCard
                        content={it.item}
                        doubleTapAction={() => doubleTapAction(name, type)}
                        longPressAction={() => longPressAction(name, type)}
                        oneTapAction={() => oneTapAction(name, type)}
                        notSelectable={
                            notSelectable || (context.lastLocalDir === "Android" && (name === "data" || name === "obb"))
                        }
                    />
                );
            }}
            keyExtractor={(it, ind) => `${it.name}${ind}`}
        />
    );
}
