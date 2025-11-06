/**
 * Authenticated app layout
 *
 * Defines the bottom tab navigation for signed-in users. The detail screens
 * (e.g., group and expense detail routes) are part of this stack but hidden
 * from the tab bar via `href: null`.
 */
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import { Colors } from "../../constants/theme";

export default function AuthLayout() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    return (
        <Tabs
        screenOptions={{
            // Use themed colors for the tab bar and hide headers (handled per screen)
            headerShown: false,
            tabBarStyle: { 
                backgroundColor: isDark ? Colors.dark.background : Colors.light.background,
                height: 60,
                borderTopColor: isDark ? "#2b2d31" : "#dee2e6",
            },
            tabBarActiveTintColor: isDark ? Colors.dark.tint : Colors.light.tint,
            tabBarInactiveTintColor: isDark ? "#9BA1A6" : "#6c757d",
        }}
        >
        <Tabs.Screen
            name="index"
            options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
                <Ionicons name="home-outline" size={size} color={color} />
            ),
            }}
        />
        <Tabs.Screen
            name="groups"
            options={{
            title: "Groups",
            tabBarIcon: ({ color, size }) => (
                <Ionicons name="people-outline" size={size} color={color} />
            ),
            }}
        />
        <Tabs.Screen
            name="profile"
            options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
                <Ionicons name="person-outline" size={size} color={color} />
            ),
            }}
        />
        <Tabs.Screen
            name="groups/[id]"
            options={{
            // Hide details route from the tab bar; it still lives in the same navigator
            href: null,
            }}
        />
        <Tabs.Screen
            name="expenses/[id]"
            options={{
            // Hide expense details route from the tab bar as well
            href: null,
            }}
        />
        </Tabs>
    );
}
