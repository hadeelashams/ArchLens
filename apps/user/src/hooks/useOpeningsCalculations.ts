import { useState, useEffect, useMemo } from 'react';
import { db } from '@archlens/shared';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface RoomOpeningData {
    id: string;
    name: string;
    doorCount: number;
    windowCount: number;
}

interface OpeningsCalculationsProps {
    totalArea: number;
    tier: string;
    rooms?: any[];
}

export function useOpeningsCalculations({ totalArea, tier, rooms }: OpeningsCalculationsProps) {
    const [loading, setLoading] = useState(true);
    const [materials, setMaterials] = useState<any[]>([]);
    // Room-wise selections: { [roomId]: { door: material, window: material } }
    const [roomSelections, setRoomSelections] = useState<Record<string, { door?: any; window?: any }>>({});

    // Build room-wise breakdown from AI-detected data
    const roomBreakdown: RoomOpeningData[] = useMemo(() => {
        if (!rooms || rooms.length === 0) return [];
        return rooms
            .filter((room: any) => room.doorCount !== undefined || room.windowCount !== undefined)
            .map((room: any) => ({
                id: room.id,
                name: room.name || 'Room',
                doorCount: room.doorCount || 0,
                windowCount: room.windowCount || 0,
            }));
    }, [rooms]);

    const hasAIData = roomBreakdown.length > 0;

    // AI-Detected totals or fallback
    const { estimatedDoors, estimatedWindows } = useMemo(() => {
        if (hasAIData) {
            const aiDoors = roomBreakdown.reduce((s, r) => s + r.doorCount, 0);
            const aiWindows = roomBreakdown.reduce((s, r) => s + r.windowCount, 0);
            return { estimatedDoors: Math.max(1, aiDoors), estimatedWindows: Math.max(1, aiWindows) };
        }
        const roomCount = Math.max(1, Math.round(totalArea / 250));
        return { estimatedDoors: roomCount + 1, estimatedWindows: roomCount * 2 };
    }, [hasAIData, roomBreakdown, totalArea]);

    useEffect(() => {
        async function fetchMaterials() {
            try {
                const q = query(collection(db, 'materials'), where('category', '==', 'Openings'));
                const snapshot = await getDocs(q);
                const mats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMaterials(mats);
            } catch (error) {
                console.error("Error fetching openings materials:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchMaterials();
    }, []);

    // Check if all rooms have both door + window selected
    const allRoomsSelected = useMemo(() => {
        if (!hasAIData) return false;
        return roomBreakdown.every(room => {
            const sel = roomSelections[room.id];
            const needDoor = room.doorCount > 0;
            const needWindow = room.windowCount > 0;
            return (!needDoor || sel?.door) && (!needWindow || sel?.window);
        });
    }, [hasAIData, roomBreakdown, roomSelections]);

    const calculation = useMemo(() => {
        let totalCost = 0;
        const items: any[] = [];

        if (hasAIData) {
            // Room-wise calculation
            roomBreakdown.forEach(room => {
                const sel = roomSelections[room.id];
                if (sel?.door && room.doorCount > 0) {
                    const cost = sel.door.pricePerUnit * room.doorCount;
                    totalCost += cost;
                    items.push({
                        name: `${room.name} - Doors (${sel.door.name})`,
                        qty: room.doorCount,
                        unit: 'Nos',
                        price: sel.door.pricePerUnit,
                        total: cost
                    });
                }
                if (sel?.window && room.windowCount > 0) {
                    const cost = sel.window.pricePerUnit * room.windowCount;
                    totalCost += cost;
                    items.push({
                        name: `${room.name} - Windows (${sel.window.name})`,
                        qty: room.windowCount,
                        unit: 'Nos',
                        price: sel.window.pricePerUnit,
                        total: cost
                    });
                }
            });
        }

        return { totalCost, items };
    }, [roomSelections, roomBreakdown, hasAIData]);

    return {
        loading,
        materials,
        roomSelections,
        setRoomSelections,
        estimatedDoors,
        estimatedWindows,
        calculation,
        roomBreakdown,
        hasAIData,
        allRoomsSelected
    };
}
