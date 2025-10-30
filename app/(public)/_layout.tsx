import { Stack } from "expo-router";
import { useColorScheme } from "react-native";
import { Colors } from "../../constants/theme";

export default function PublicLayout() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    return (
        <Stack
        screenOptions={{
            headerShown: false,
            contentStyle: {
                backgroundColor: isDark ? Colors.dark.background : Colors.light.background,
            },
        }}
        >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        </Stack>
    );
}
