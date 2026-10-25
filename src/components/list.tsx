import { memo, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import {
    GestureDetector,
    useExclusiveGestures,
    useLongPressGesture,
    useTapGesture
} from "react-native-gesture-handler";
import { useAppContext } from "./app-context-provider";
import { useOperationContext } from "./operation-provider";
import type {
    ContentCardProps,
    ContentThumbnailProps,
    FileContent,
    ListProps,
    ThumbnailState
} from "../types/components";
import type { ListViewMode } from "../types/ui";
import type { FileIcons } from "../types/files";
import { contentCard, fileList } from "../styles/components/style";
import { useTheme } from "./theme-provider";
import FileUtils from "../utils/file-utils";

const FILE_ICONS: FileIcons = {
    dir: require("../../assets/images/folder.png"),
    file: require("../../assets/images/file.png"),
    image: require("../../assets/images/image.png"),
    video: require("../../assets/images/video.png"),
    audio: require("../../assets/images/audio.png"),
    compress: require("../../assets/images/compress.png"),
    pdf: require("../../assets/images/pdf.png"),
    word: require("../../assets/images/word.png"),
    excel: require("../../assets/images/excel.png"),
    power: require("../../assets/images/power.png"),
    apk: require("../../assets/images/apk.png"),
    exe: require("../../assets/images/exe.png"),
    code: require("../../assets/images/code.png"),
    text: require("../../assets/images/text.png"),
    system: require("../../assets/images/system.png")
};
const THUMBNAIL_RETRY_TIME = 2000;
const DEFAULT_THUMBNAIL: ThumbnailState = { isLoading: false, source: null };
const LOADING_THUMBNAIL: ThumbnailState = { isLoading: true, source: null };

function ContentCard(props: ContentCardProps) {
    const { content, doubleTapAction, longPressAction, oneTapAction, selected, storage, viewMode } = props;
    const { theme } = useTheme();
    const tap = useTapGesture({ numberOfTaps: 1, onActivate: oneTapAction, runOnJS: true });
    const doubleTap = useTapGesture({ numberOfTaps: 2, onActivate: doubleTapAction, runOnJS: true });
    const longPress = useLongPressGesture({ minDuration: 200, onActivate: longPressAction, runOnJS: true });
    const gestures = useExclusiveGestures(doubleTap, tap, longPress);

    return (
        <GestureDetector gesture={gestures}>
            <View style={[getContentCardStyle(viewMode), selected && contentCard.selected]}>
                <ContentThumbnail content={content} storage={storage} viewMode={viewMode} />
                <Text
                    numberOfLines={viewMode === "LIST" ? 2 : 3}
                    style={[viewMode === "LIST" ? contentCard.listText : contentCard.text, { color: theme.text }]}
                >
                    {content.name}
                </Text>
            </View>
        </GestureDetector>
    );
}

const ContentThumbnail = memo(function Thumbnail(props: ContentThumbnailProps) {
    const { content, storage, viewMode } = props;
    const { theme } = useTheme();
    const fileType = content.type.toLocaleLowerCase() === "file" ? FileUtils.getTypeFile(content.name) : "dir";
    const { handleError, imageSource, isLoading } = useContentThumbnail(content, storage, fileType);
    const { icon, thumbnail } = getThumbnailStyles(viewMode);

    return (
        <View style={thumbnail}>
            {isLoading ? (
                <ActivityIndicator color={theme.accent} size="large" />
            ) : (
                <Image resizeMode="cover" style={icon} source={imageSource} onError={() => void handleError()} />
            )}
            {!isLoading && fileType === "video" && (
                <View pointerEvents="none" style={contentCard.videoOverlay}>
                    <Ionicons name="play" size={20} color="white" />
                </View>
            )}
        </View>
    );
});

function useContentThumbnail(content: FileContent, storage: "local" | "ftp", fileType: keyof FileIcons) {
    const { ftpDirectory } = useAppContext();
    const { executeApiRequest, thumbnailGenerator } = useOperationContext();
    const localThumbnailPath = "thumbnailPath" in content ? content.thumbnailPath : undefined;
    const supportsFtpThumbnail = "supportsThumbnail" in content && content.supportsThumbnail === true;
    const canGenerateLocalThumbnail = fileType === "image" || fileType === "video";
    const mode = getThumbnailMode(storage, localThumbnailPath, canGenerateLocalThumbnail, supportsFtpThumbnail);
    const remoteDir = storage === "ftp" ? ftpDirectory.dir : undefined;
    const [thumbnail, setThumbnail] = useState<ThumbnailState>(() => (mode ? LOADING_THUMBNAIL : DEFAULT_THUMBNAIL));

    async function handleError() {
        if (mode !== "FTP") {
            setThumbnail(DEFAULT_THUMBNAIL);
            return;
        }

        let invalidToken = false;
        const result = await executeApiRequest(
            async (apiUtils) => {
                const response = await apiUtils.getThumbnail({ dir: remoteDir, name: content.name });
                if (!response.success && response.error.code === "INVALID_TOKEN") {
                    invalidToken = true;
                }

                return response;
            },
            { isBackground: true }
        );
        if (invalidToken && result.success && result.data.status === "AVAILABLE") {
            const { headers, uri } = result.data;
            if (uri) {
                setThumbnail({ isLoading: false, source: { uri, headers } });
                return;
            }
        }

        setThumbnail(DEFAULT_THUMBNAIL);
    }

    useEffect(() => {
        let cancelled = false;
        let retry: ReturnType<typeof setTimeout> | undefined;
        setThumbnail((current) =>
            mode ? (current.isLoading && !current.source ? current : LOADING_THUMBNAIL) : DEFAULT_THUMBNAIL
        );

        async function loadFtpThumbnail() {
            const result = await executeApiRequest(
                (apiUtils) => apiUtils.getThumbnail({ dir: remoteDir, name: content.name }),
                { isBackground: true }
            );
            if (cancelled) {
                return;
            }

            if (!result.success || result.data.status === "UNAVAILABLE") {
                setThumbnail(DEFAULT_THUMBNAIL);
                return;
            }

            const { headers, status, uri } = result.data;
            if (status === "AVAILABLE" && uri) {
                setThumbnail({ isLoading: false, source: { uri, headers } });
            } else if (status === "PENDING") {
                retry = setTimeout(() => void loadFtpThumbnail(), THUMBNAIL_RETRY_TIME);
            }
        }

        if (mode === "LOCAL" && localThumbnailPath) {
            void thumbnailGenerator.generate(localThumbnailPath).then(
                (uri) => {
                    if (!cancelled) {
                        setThumbnail(uri ? { isLoading: false, source: { uri } } : DEFAULT_THUMBNAIL);
                    }
                },
                () => {
                    if (!cancelled) {
                        setThumbnail(DEFAULT_THUMBNAIL);
                    }
                }
            );
        } else if (mode === "FTP") {
            void loadFtpThumbnail();
        }

        return () => {
            cancelled = true;
            if (retry) {
                clearTimeout(retry);
            }
        };
    }, [content.name, executeApiRequest, localThumbnailPath, mode, remoteDir, thumbnailGenerator]);

    return {
        handleError,
        imageSource: thumbnail.source ?? FILE_ICONS[fileType],
        isLoading: thumbnail.isLoading
    };
}

function getThumbnailMode(
    storage: "local" | "ftp",
    localPath: string | undefined,
    canGenerateLocal: boolean,
    supportsFtp: boolean
): "LOCAL" | "FTP" | null {
    if (storage === "local" && localPath && canGenerateLocal) {
        return "LOCAL";
    }

    return storage === "ftp" && supportsFtp ? "FTP" : null;
}

export default function List<T extends FileContent>(props: ListProps<T>) {
    const { dirContent, doubleTapAction, longPressAction, oneTapAction, selectAll, storage } = props;
    const { theme } = useTheme();
    const { modifyFtpFile, modifyLocalFile, activeStorageRoot, lastLocalDir, setViewMode, viewMode } = useAppContext();
    const columnCount = getColumnCount(viewMode);
    const selectionCount = storage === "ftp" ? modifyFtpFile.length : modifyLocalFile.length;
    const selectableCount = dirContent.length;
    const allSelected = selectableCount > 0 && selectionCount === selectableCount;
    const showSelectAll = selectionCount > 0;

    function executeIfAvailable(callback: () => void): void {
        callback();
    }

    return (
        <>
            <View style={fileList.toolbar}>
                {showSelectAll && (
                    <Pressable style={fileList.selectAll} onPress={() => selectAll(!allSelected)}>
                        <Text style={[fileList.selectAllText, { color: theme.text }]}>Seleccionar todo</Text>
                        {allSelected ? (
                            <Ionicons
                                style={fileList.selectAllIcon}
                                name="checkbox-outline"
                                color={theme.text}
                                size={20}
                            />
                        ) : (
                            <Ionicons
                                style={fileList.selectAllIcon}
                                name="square-outline"
                                color={theme.text}
                                size={20}
                            />
                        )}
                    </Pressable>
                )}
                <View style={fileList.viewActions}>
                    <Pressable
                        style={[fileList.viewButton, viewMode === "LIST" && fileList.activeViewButton]}
                        onPress={() => setViewMode("LIST")}
                    >
                        <Ionicons name="list-outline" color={theme.text} size={26} />
                    </Pressable>
                    <Pressable
                        style={[fileList.viewButton, viewMode === "SMALL_ICONS" && fileList.activeViewButton]}
                        onPress={() => setViewMode("SMALL_ICONS")}
                    >
                        <Ionicons name="apps-outline" color={theme.text} size={20} />
                    </Pressable>
                    <Pressable
                        style={[fileList.viewButton, viewMode === "LARGE_ICONS" && fileList.activeViewButton]}
                        onPress={() => setViewMode("LARGE_ICONS")}
                    >
                        <Ionicons name="grid-outline" color={theme.text} size={20} />
                    </Pressable>
                </View>
            </View>
            <FlatList
                key={viewMode}
                style={fileList.content}
                data={[...dirContent].sort(({ name: aName }, { name: bName }) =>
                    aName.localeCompare(bName, undefined, { numeric: true })
                )}
                initialNumToRender={12}
                numColumns={columnCount}
                renderItem={({ item }) => {
                    const currentDir = lastLocalDir === " " ? "" : `${lastLocalDir}/`;
                    return (
                        <ContentCard
                            content={item}
                            storage={storage}
                            doubleTapAction={() => doubleTapAction(item.name, item.type)}
                            longPressAction={() => executeIfAvailable(() => longPressAction(item.name, item.type))}
                            oneTapAction={() => executeIfAvailable(() => oneTapAction(item.name, item.type))}
                            selected={
                                storage === "ftp"
                                    ? modifyFtpFile.some(({ path }) => path === item.name)
                                    : "thumbnailPath" in item &&
                                      modifyLocalFile.some(
                                          ({ path }) => path === `${activeStorageRoot.path}/${currentDir}${item.name}`
                                      )
                            }
                            viewMode={viewMode}
                        />
                    );
                }}
                keyExtractor={({ name, type }) => `${type}:${name}`}
            />
        </>
    );
}

function getColumnCount(viewMode: ListViewMode): number {
    if (viewMode === "LIST") {
        return 2;
    }

    return viewMode === "SMALL_ICONS" ? 4 : 3;
}

function getContentCardStyle(viewMode: ListViewMode) {
    if (viewMode === "LIST") {
        return contentCard.list;
    }

    return viewMode === "SMALL_ICONS" ? contentCard.small : contentCard.large;
}

function getThumbnailStyles(viewMode: ListViewMode) {
    if (viewMode === "LIST") {
        return { icon: contentCard.iconList, thumbnail: contentCard.thumbnailList };
    }

    return viewMode === "SMALL_ICONS"
        ? { icon: contentCard.iconSmall, thumbnail: contentCard.thumbnailSmall }
        : { icon: contentCard.iconLarge, thumbnail: contentCard.thumbnailLarge };
}
