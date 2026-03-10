import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function PlanDetailsScreen({ navigation }: any) {
  const [planName, setPlanName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState('Residential');
  const [loading, setLoading] = useState(false);

  const projectTypes = ['Residential', 'Commercial', 'Industrial', 'Other'];

  const handleContinue = () => {
    if (!planName.trim()) {
      Alert.alert('Required', 'Please enter a plan name');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Required', 'Please enter a location');
      return;
    }

    // Pass the plan details to UploadPlan screen
    navigation.navigate('UploadPlan', {
      planName,
      location,
      description,
      projectType,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color="#315b76" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Plan Details</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            bounces={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* UNIFIED CARD WITH ICON AND FORM */}
            <View style={styles.infoCard}>
              <View style={styles.iconBg}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={32}
                  color="#315b76"
                />
              </View>
              <Text style={styles.infoTitle}>Enter Your Plan Details</Text>

              {/* FORM SECTION */}
              <View style={styles.formSection}>
              {/* PLAN NAME */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Plan Name</Text>
                  <Text style={styles.required}>*</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons
                    name="file-document"
                    size={18}
                    color="#cbd5e1"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Plan name"
                    placeholderTextColor="#cbd5e1"
                    value={planName}
                    onChangeText={setPlanName}
                  />
                </View>
              </View>

              {/* LOCATION */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Location</Text>
                  <Text style={styles.required}>*</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={18}
                    color="#cbd5e1"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Location"
                    placeholderTextColor="#cbd5e1"
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>
              </View>

              {/* PROJECT TYPE */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Project Type</Text>
                <View style={styles.typeGrid}>
                  {projectTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        projectType === type && styles.typeButtonActive,
                      ]}
                      onPress={() => setProjectType(type)}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          projectType === type && styles.typeButtonTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* DESCRIPTION */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Description (Optional)</Text>
                <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Add any additional details about your project..."
                    placeholderTextColor="#cbd5e1"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>
              </View>
            </View>
          </ScrollView>

          {/* BUTTON */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
              disabled={loading}
            >
              <LinearGradient
                colors={['#315b76', '#4a7c9b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Continue to Upload Plan</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 120,
  },

  // HEADER
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },

  // INFO CARD
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'center',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    alignSelf: 'center',
  },

  // FORM SECTION
  formSection: {
    width: '100%',
    marginTop: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
  },

  // INPUT STYLES
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  textAreaWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  textArea: {
    paddingVertical: 10,
    maxHeight: 120,
  },

  // PROJECT TYPE SELECTOR
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  typeButtonActive: {
    backgroundColor: '#315b76',
    borderColor: '#315b76',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  typeButtonTextActive: {
    color: '#fff',
  },

  // BUTTON
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  continueButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
