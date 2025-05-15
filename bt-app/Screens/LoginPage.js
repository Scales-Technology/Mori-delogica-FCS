import React, { useState, useEffect } from "react";
import {
  Text,
  TextInput,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ToastAndroid,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
  Image,
  View,
} from "react-native";
import { useDispatch } from "react-redux";
import { setUser, setLoggedIn } from "../store";
import { auth, db } from "../Database/config";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import { useNavigation } from "@react-navigation/native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "", // Added name field
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const dispatch = useDispatch();
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        dispatch(setUser(user));
        dispatch(setLoggedIn(true));
        navigation.replace("TabLayout");
      }
    });

    return unsubscribe;
  }, [dispatch, navigation]);

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(""); // Clear error when user starts typing
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return false;
    }
    if (isSignUp && !formData.name) {
      setError("Name is required for sign-up");
      return false;
    }
    if (!formData.email.includes("@")) {
      setError("Please enter a valid email address");
      return false;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return false;
    }
    return true;
  };

  const handleAuthentication = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const { user } = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        // Update the user's display name in Firebase Authentication
        await updateProfile(user, { displayName: formData.name });

        // Store user data in Firestore, including the name
        await addDoc(collection(db, "Users"), {
          uid: user.uid,
          email: user.email,
          name: formData.name, // Add name to Firestore
          role: "warehouse_staff",
          createdAt: serverTimestamp(),
        });

        ToastAndroid.show("Account created successfully! You are registered as staff.", ToastAndroid.LONG);
      } else {
        await signInWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        ToastAndroid.show("Welcome back!", ToastAndroid.LONG);
      }

      dispatch(setLoggedIn(true));
      navigation.replace("TabLayout");
    } catch (err) {
      setError(
        err.code === "auth/email-already-in-use"
          ? "Email already registered. Please login instead."
          : err.code === "auth/invalid-email"
          ? "Invalid email address"
          : err.code === "auth/wrong-password"
          ? "Invalid password"
          : "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("../assets/images/loginbackground.jpg")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Image
              source={require("../assets/images/lg1.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Welcome</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {isSignUp && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor="#999"
                  onChangeText={(text) => handleInputChange("name", text)}
                  value={formData.name}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                onChangeText={(text) => handleInputChange("email", text)}
                value={formData.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#999"
                secureTextEntry
                onChangeText={(text) => handleInputChange("password", text)}
                value={formData.password}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleAuthentication}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUp ? "Sign Up" : "Login"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsSignUp(!isSignUp)}
              disabled={loading}
            >
              <Text style={styles.switchButtonText}>
                {isSignUp
                  ? "Already have an account? Login"
                  : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  title: {
    fontSize: 40,
    color: "white",
    marginBottom: 30,
    fontFamily: "Poppins-ExtraBold",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  logo: {
    width: 250,
    height: 120,
    marginBottom: 20,
  },
  inputContainer: {
    width: "85%",
    marginVertical: 10,
  },
  inputLabel: {
    color: "white",
    fontSize: 16,
    marginBottom: 5,
    fontFamily: "Poppins-Medium",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 3,
  },
  input: {
    width: "100%",
    height: 55,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderColor: "#3A7D44",
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 20,
    fontFamily: "Poppins-Regular",
    fontSize: 16,
    color: "#333",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  button: {
    width: "85%",
    height: 55,
    backgroundColor: "#3A7D44",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: "#8BADA1",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Poppins-Medium",
    letterSpacing: 1,
  },
  errorText: {
    color: "#FF5252",
    marginBottom: 15,
    textAlign: "center",
    fontFamily: "Poppins-Medium",
    paddingHorizontal: 20,
    fontSize: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    overflow: "hidden",
  },
  switchButton: {
    marginTop: 20,
    padding: 10,
  },
  switchButtonText: {
    color: "#7CFC00",
    fontFamily: "Poppins-Medium",
    fontSize: 16,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 5,
  },
});

export default LoginPage;