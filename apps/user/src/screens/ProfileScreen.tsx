import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '@archlens/shared';
import { signOut } from 'firebase/auth';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen({ navigation }: any) {
  const user = auth.currentUser;

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Logout", 
        style: "destructive", 
        onPress: async () => {
          try { await signOut(auth); } catch (error: any) { console.error(error.message); }
        } 
      }
    ]);
  };

  const ProfileOption = ({ icon, title, subtitle, onPress, color = "#315b76" }: any) => (
    <TouchableOpacity style={styles.optionRow} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: color + '10' }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <View style={styles.optionTextContainer}>
        <Text style={styles.optionTitle}>{title}</Text>
        {subtitle && <Text style={styles.optionSubtitle}>{subtitle}</Text>}
      </View>
      <Feather name="chevron-right" size={20} color="#cbd5e1" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <LinearGradient colors={['#315b76', '#2a4179']} start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}style={styles.userCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{user?.email?.charAt(0).toUpperCase() || 'U'}</Text>
            </View>
            <Text style={styles.userName}>{user?.displayName || "Arch Lens "}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </LinearGradient>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Account Settings</Text>
            <ProfileOption 
                icon="user" title="Personal Information" subtitle="Name, email, and phone" 
                onPress={() => navigation.navigate('PersonalInfo')} 
            />
            <ProfileOption 
                icon="bell" title="Notifications" subtitle="Alerts and updates" 
                onPress={() => navigation.navigate('Notifications')} 
            />
            <ProfileOption 
                icon="shield" title="Security" subtitle="Password and privacy" 
                onPress={() => navigation.navigate('Security')} 
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Support</Text>
            <ProfileOption 
                icon="help-circle" title="Help Center" 
                onPress={() => navigation.navigate('HelpCenter')} 
            />
            <ProfileOption 
                icon="file-text" title="Privacy Policy" 
                onPress={() => navigation.navigate('PrivacyPolicy')} 
            />
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
          
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </ScrollView>

        {/* BOTTOM NAV BAR */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home-outline" size={24} color="#64748b" />
            <Text style={styles.navText}>HOME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="document-text-outline" size={24} color="#64748b" />
            <Text style={styles.navText}>ESTIMATES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="person" size={24} color="#315b76" />
            <Text style={[styles.navText, {color: '#315b76'}]}>PROFILE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ... styles remain the same
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
    scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },
    userCard: { borderRadius: 20, padding: 25, alignItems: 'center', marginBottom: 30, elevation: 4 },
    avatarCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 2, borderColor: '#ffffff' },
    avatarText: { fontSize: 28, color: '#ffffff', fontWeight: 'bold' },
    userName: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
    userEmail: { fontSize: 14, color: '#bae6fd', marginTop: 4 },
    section: { marginBottom: 25 },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1 },
    optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    iconContainer: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    optionTextContainer: { flex: 1, marginLeft: 15 },
    optionTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
    optionSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
    logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f2', padding: 16, borderRadius: 15, marginTop: 10 },
    logoutText: { color: '#ef4444', fontWeight: '700', marginLeft: 10, fontSize: 16 },
    versionText: { textAlign: 'center', color: '#cbd5e1', fontSize: 12, marginTop: 30 },
    bottomNav: { position: 'absolute', bottom: 25, left: 20, right: 20, height: 70, backgroundColor: '#FFFFFF', borderRadius: 35, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 10 },
    navItem: { alignItems: 'center' },
    navText: { fontSize: 10, fontWeight: 'bold', marginTop: 4, color: '#64748b' }
});