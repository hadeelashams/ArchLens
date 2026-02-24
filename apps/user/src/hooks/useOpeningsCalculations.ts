import { useState, useEffect, useMemo } from 'react';
import { db } from '@archlens/shared';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface OpeningsCalculationsProps {
    totalArea: number;
    tier: string;
}

export function useOpeningsCalculations({ totalArea, tier }: OpeningsCalculationsProps) {
    const [loading, setLoading] = useState(true);
    const [materials, setMaterials] = useState<any[]>([]);
    const [selections, setSelections] = useState<Record<string, any>>({});

    // Doors and Windows counts estimate based on area (simple rule of thumb)
    const roomCount = Math.max(1, Math.round(totalArea / 250));
    const estimatedDoors = roomCount + 1; // Rooms + 1 Main door
    const estimatedWindows = roomCount * 2;

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

    const calculation = useMemo(() => {
        let totalCost = 0;
        const items: any[] = [];

        // Calculate Door Costs (Simple assumption: all doors use same selected material for now)
        const selectedDoor = selections['door'];
        if (selectedDoor) {
            const doorCost = selectedDoor.pricePerUnit * estimatedDoors;
            totalCost += doorCost;
            items.push({
                name: `Doors (${selectedDoor.name})`,
                qty: estimatedDoors,
                unit: 'Nos',
                price: selectedDoor.pricePerUnit,
                total: doorCost
            });
        }

        // Calculate Window Costs
        const selectedWindow = selections['window'];
        if (selectedWindow) {
            const windowCost = selectedWindow.pricePerUnit * estimatedWindows;
            totalCost += windowCost;
            items.push({
                name: `Windows (${selectedWindow.name})`,
                qty: estimatedWindows,
                unit: 'Nos',
                price: selectedWindow.pricePerUnit,
                total: windowCost
            });
        }

        return { totalCost, items };
    }, [selections, estimatedDoors, estimatedWindows]);

    return {
        loading,
        materials,
        selections,
        setSelections,
        estimatedDoors,
        estimatedWindows,
        calculation
    };
}
