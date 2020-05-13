import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {Text} from 'react-native-paper';
import {TextInput} from 'react-native-paper';
import AsyncStorage from '@react-native-community/async-storage';
import {Button} from 'react-native-paper';

export default function LoginScreen(props) {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setLoading(true);
    try {
      await AsyncStorage.setItem('userId', userId);
      setLoading(false);
      props.navigation.push('Call');
    } catch (err) {
      console.log('Error', err);
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.heading}>Enter your id</Text>
        <TextInput
          label="Your  ID"
          onChangeText={text => setUserId(text)}
          mode="outlined"
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={onLogin}
          loading={loading}
          style={styles.btn}
          contentStyle={styles.btnContent}
          disabled={userId.length === 0}>
          Login
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#fff',
    flex: 1,
    // alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    // alignSelf: 'center',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 18,
    marginBottom: 10,
    fontWeight: '600',
  },
  input: {
    height: 60,
    marginBottom: 10,
  },
  btn: {
    height: 60,
    alignItems: 'stretch',
    justifyContent: 'center',
    fontSize: 18,
  },
  btnContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
});
