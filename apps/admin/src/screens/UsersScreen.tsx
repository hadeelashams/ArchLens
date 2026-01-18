import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, TextInput, 
  FlatList, ActivityIndicator, Alert, Image 
} from 'react-native';
import { db } from '@archlens/shared'; 
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Feather } from '@expo/vector-icons';
import { Sidebar } from './Sidebar';

const BLUE_ARCH = '#1e293b';

export default function UsersScreen({ navigation }: any) {
  // --- STATE ---
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // --- 1. FETCH USERS FROM FIREBASE ---
  useEffect(() => {
    // Reference to the users collection
    const ref = collection(db, 'users');
    
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));

      // --- FILTER STEP: REMOVE ADMINS ---
      // This line ensures that anyone with role 'admin' is hidden from the list
      const nonAdminUsers = data.filter((user: any) => user.role !== 'admin');

      // --- SORT STEP: NEWEST FIRST ---
      // We do this in JS to safely handle missing createdAt fields
      nonAdminUsers.sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      setUsers(nonAdminUsers);
      setFilteredUsers(nonAdminUsers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- 2. SEARCH FILTER ---
  useEffect(() => {
    if (!searchQuery) {
      setFilteredUsers(users);
    } else {
      const lowerQ = searchQuery.toLowerCase();
      const result = users.filter(u => 
        (u.name && u.name.toLowerCase().includes(lowerQ)) ||
        (u.email && u.email.toLowerCase().includes(lowerQ)) ||
        (u.phone && u.phone.includes(lowerQ))
      );
      setFilteredUsers(result);
    }
  }, [searchQuery, users]);

  // --- 3. DELETE USER ACTION ---
  const handleDeleteUser = (userId: string, userName: string) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to remove ${userName || 'this user'}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', userId));
              Alert.alert("Success", "User removed successfully.");
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          }
        }
      ]
    );
  };

  // --- HELPER: GET INITIALS ---
  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  // --- HELPER: FORMAT DATE ---
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Date N/A';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return 'Invalid Date';
    }
  };

  return (
    <View style={styles.container}>
      {/* Sidebar with active route set to 'Users' */}
      <Sidebar navigation={navigation} activeRoute="Users" />

      <View style={styles.mainContent}>
        
        {/* HEADER SECTION */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Registered Users</Text>
            <Text style={styles.subHeaderText}>View and manage registered architects and contractors.</Text>
          </View>
          
          {/* SEARCH BAR */}
          <View style={styles.searchBox}>
            <Feather name="search" size={18} color="#64748b" />
            <TextInput 
              style={styles.searchInput} 
              placeholder="Search by name or email..." 
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* DATA TABLE */}
        <View style={styles.tableContainer}>
          {/* TABLE HEADER */}
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2.5 }]}>USER PROFILE</Text>
            <Text style={[styles.th, { flex: 2 }]}>CONTACT INFO</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>JOIN DATE</Text>
            <Text style={[styles.th, { flex: 1 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 0.5, textAlign: 'right' }]}>ACTION</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={BLUE_ARCH} style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={item => item.id}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Feather name="users" size={40} color="#cbd5e1" />
                  <Text style={{color: '#94a3b8', marginTop: 10}}>No users found.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.tr}>
                  
                  {/* COL 1: AVATAR & NAME */}
                  <View style={{ flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.avatar}>
                      {item.photoUrl ? (
                        <Image source={{ uri: item.photoUrl }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarText}>{getInitials(item.displayName || item.email)}</Text>
                      )}
                    </View>
                    <View>
                      <Text style={styles.tdName}>{item.displayName || 'Unnamed User'}</Text>
                      <Text style={styles.tdRole}>{item.role || 'Standard User'}</Text>
                    </View>
                  </View>

                  {/* COL 2: EMAIL & PHONE */}
                  <View style={{ flex: 2 }}>
                    <View style={styles.contactRow}>
                      <Feather name="mail" size={12} color="#94a3b8" />
                      <Text style={styles.tdText}>{item.email}</Text>
                    </View>
                    {item.phone && (
                      <View style={[styles.contactRow, { marginTop: 4 }]}>
                        <Feather name="phone" size={12} color="#94a3b8" />
                        <Text style={styles.tdText}>{item.phone}</Text>
                      </View>
                    )}
                  </View>

                  {/* COL 3: DATE */}
                  <Text style={[styles.tdText, { flex: 1.5 }]}>{formatDate(item.createdAt)}</Text>

                  {/* COL 4: STATUS */}
                  <View style={{ flex: 1 }}>
                     <View style={[styles.statusBadge, item.isActive === false ? styles.badgeInactive : styles.badgeActive]}>
                        <Text style={[styles.statusText, item.isActive === false ? styles.textInactive : styles.textActive]}>
                          {item.isActive === false ? 'Inactive' : 'Active'}
                        </Text>
                     </View>
                  </View>

                  {/* COL 5: ACTIONS */}
                  <View style={styles.actionCell}>
                    <TouchableOpacity onPress={() => handleDeleteUser(item.id, item.name)}>
                      <Feather name="trash-2" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>

                </View>
              )}
            />
          )}
        </View>

      </View>
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f1f5f9' },
  mainContent: { flex: 1, padding: 40 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  subHeaderText: { fontSize: 14, color: '#64748b', marginTop: 4 },
  
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 15, width: 350, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 10, fontSize: 14, outlineStyle: 'none' } as any,

  tableContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 2 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center' },

  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  tdName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  tdRole: { fontSize: 12, color: '#64748b', marginTop: 1 },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tdText: { fontSize: 13, color: '#475569' },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeInactive: { backgroundColor: '#f1f5f9' },
  statusText: { fontSize: 11, fontWeight: '700' },
  textActive: { color: '#166534' },
  textInactive: { color: '#64748b' },

  actionCell: { flex: 0.5, flexDirection: 'row', justifyContent: 'flex-end' },
});