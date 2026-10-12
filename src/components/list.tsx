import { FlatList } from "react-native";
import { useAppContext } from "./app-context-provider";
import type { ListProps } from "../types/components";
import type { FileContent } from "../types/components";
import ContentCard from "./content-card";

export default function List<T extends FileContent>(props: ListProps<T>) {
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
                            notSelectable ||
                            (context.localDirectory.dir === "Android" && (name === "data" || name === "obb"))
                        }
                    />
                );
            }}
            keyExtractor={(it, ind) => `${it.name}${ind}`}
        />
    );
}
