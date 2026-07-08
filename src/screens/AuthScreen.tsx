import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, TextStyle, ViewStyle, View, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ZM_COLORS, GLOBAL_STYLES } from '../theme/colors';
import { supabase } from '../services/supabase';

// Misma instancia Supabase que ZenTask: el usuario de ZenTask sirve aquí.

export const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${msg}`);
  } else {
    Alert.alert(title, msg);
  }
};

const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      showAlert('Faltan datos', 'Ingresa email y contraseña');
      return;
    }

    setLoading(true);
    try {
      if (isRegisterMode) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        showAlert('VERIFICACIÓN', 'Revisa tu correo y confirma la cuenta.');
        setIsRegisterMode(false);
      } else {
        // El SDK guarda y refresca la sesión solo; App.tsx se entera
        // vía onAuthStateChange.
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error('Error auth:', err);
      showAlert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const INPUT: TextStyle = { ...GLOBAL_STYLES.input, padding: 18 };

  const GOLD_BUTTON: ViewStyle = {
    ...GLOBAL_STYLES.primaryButton,
    padding: 18,
    marginTop: 10,
    shadowColor: '#FFF',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    // @ts-ignore
    cursor: 'pointer',
  };

  const LINK_TEXT: TextStyle = {
    color: ZM_COLORS.DIM_GRAY,
    textDecorationLine: 'underline',
    fontSize: 14,
    marginTop: 20,
    // @ts-ignore
    cursor: 'pointer',
  };

  return (
    <SafeAreaView style={[GLOBAL_STYLES.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={{ width: '100%', maxWidth: 400 }}>
        <Text style={GLOBAL_STYLES.appName}>ZenMoney</Text>
        <Text style={GLOBAL_STYLES.subtitle}>
          {isRegisterMode ? '>> INICIAR PROTOCOLO DE ALTA' : '>> CREDENCIALES DE ACCESO'}
        </Text>

        <TextInput
          style={INPUT}
          onChangeText={setEmail}
          value={email}
          placeholder="CORREO ELECTRÓNICO"
          placeholderTextColor={ZM_COLORS.DIM_GRAY}
          autoCapitalize="none"
        />

        <TextInput
          style={INPUT}
          onChangeText={setPassword}
          value={password}
          secureTextEntry={true}
          placeholder="CONTRASEÑA"
          placeholderTextColor={ZM_COLORS.DIM_GRAY}
          autoCapitalize="none"
        />

        <TouchableOpacity style={GOLD_BUTTON} onPress={handleAuth} disabled={loading}>
          <Text style={{ color: ZM_COLORS.DEEP_BLACK, fontWeight: '900', fontSize: 18, letterSpacing: 1 }}>
            {loading ? 'PROCESANDO...' : isRegisterMode ? 'REGISTRAR AGENTE' : 'ACCEDER AL SISTEMA'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setIsRegisterMode(!isRegisterMode)}>
          <Text style={LINK_TEXT}>
            {isRegisterMode ? '¿Ya tienes ID? Ingresar' : '¿Sin ID? Solicitar Acceso'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AuthScreen;
