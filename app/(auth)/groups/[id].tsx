import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { getGroupById } from "../../../services/firebaseService";
import { useGlobalStyles } from "../../../styles/global-styles";

export default function GroupDetails() {
    const { id } = useLocalSearchParams();
    const [group, setGroup] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const styles = useGlobalStyles();

    useEffect(() => {
        if (!id) return;
        (async () => {
        const data = await getGroupById(id as string);
        setGroup(data);
        setLoading(false);
        })();
    }, [id]);

    if (loading) {
        return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#007bff" />
        </View>
        );
    }

    if (!group) {
        return (
        <View style={styles.container}>
            <Text style={styles.subtitle}>Group not found.</Text>
        </View>
        );
    }

    return (
        <View style={styles.screen}>
        <Text style={styles.title}>{group.name}</Text>
        <Text style={styles.subtitle}>
            Members: {group.members?.length || 0}
        </Text>
        </View>
    );
}
