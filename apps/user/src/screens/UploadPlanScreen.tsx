import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  SafeAreaView, 
  Alert,
  ScrollView,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function UploadPlanScreen({ navigation }: any) {
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pickImage = async () => {
    // Request Permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your gallery to upload the floor plan.');
      return;
    }

    // Launch Gallery
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
  };

  const handleProceed = () => {
    if (!imageUri) {
      Alert.alert("No Image", "Please upload a floor plan to proceed.");
      return;
    }
    // TODO: Navigate to Next Step (e.g., Material Estimation)
     navigation.navigate('PlanVerification', { planImage: imageUri });
    console.log("Proceeding with image:", imageUri);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Floor Plan</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.description}>
            Upload a floor plan image to get started. We support JPG and PNG files.
          </Text>

          {/* Dashed Upload Box */}
          <View style={styles.uploadCard}>
            <View style={styles.dashedBorder}>
              <Text style={styles.uploadTitle}>Upload Floor Plan</Text>
              <Text style={styles.uploadSubtitle}>JPG or PNG</Text>
              <TouchableOpacity style={styles.browseButton} onPress={pickImage}>
                <Text style={styles.browseText}>Browse Files</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Preview Section */}
          <View style={styles.previewSection}>
            <Text style={styles.sectionHeader}>Preview</Text>
            <View style={styles.previewCard}>
              {imageUri ? (
                <>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
                  <TouchableOpacity style={styles.removeButton} onPress={handleRemoveImage}>
                    <Ionicons name="close-circle" size={28} color="#ef4444" />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="image-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyStateText}>No image selected</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Proceed Button */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.proceedButton, !imageUri && styles.disabledButton]} 
            onPress={handleProceed}
            disabled={!imageUri}
          >
            <Text style={styles.proceedButtonText}>Proceed</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#F8F9FA' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  backButton: { padding: 5 },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  description: { fontSize: 14, color: '#64748b', marginTop: 10, marginBottom: 25, lineHeight: 22 },
  uploadCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 30, elevation: 2 },
  dashedBorder: { borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 16, paddingVertical: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', margin: 2 },
  uploadTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 6 },
  uploadSubtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 20 },
  browseButton: { backgroundColor: '#315b76', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 8 },
  browseText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  previewSection: { marginTop: 0 },
  sectionHeader: { fontSize: 18, fontWeight: '600', color: '#315b76', marginBottom: 15 },
  previewCard: { height: 250, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '100%', height: '100%', backgroundColor: '#fff' },
  removeButton: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 20 },
  emptyState: { alignItems: 'center' },
  emptyStateText: { color: '#94a3b8', marginTop: 10, fontSize: 14 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#F8F9FA', padding: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  proceedButton: { backgroundColor: '#315b76', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  disabledButton: { backgroundColor: 'rgb(165, 176, 192)', elevation: 0 },
  proceedButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});