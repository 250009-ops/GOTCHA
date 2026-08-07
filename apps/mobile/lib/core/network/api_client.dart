import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:http/http.dart' as http;



class ApiClient {

  ApiClient({this.baseUrl = 'http://10.0.2.2:3000/api/v1'});



  final String baseUrl;

  final _storage = const FlutterSecureStorage();

  static const _tokenKey = 'gotcha_access_token';

  static const _refreshKey = 'gotcha_refresh_token';



  Future<String?> get accessToken => _storage.read(key: _tokenKey);

  Future<String?> get refreshToken => _storage.read(key: _refreshKey);



  Future<void> saveTokens(String access, String refresh) async {

    await _storage.write(key: _tokenKey, value: access);

    await _storage.write(key: _refreshKey, value: refresh);

  }



  Future<void> clearTokens() async {

    await _storage.delete(key: _tokenKey);

    await _storage.delete(key: _refreshKey);

  }



  Future<dynamic> get(String path) => _request('GET', path);



  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {

    final res = await _request('POST', path, body: body);

    return res is Map<String, dynamic> ? res : {'data': res};

  }



  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {

    final res = await _request('PUT', path, body: body);

    return res is Map<String, dynamic> ? res : {'data': res};

  }



  Future<dynamic> _request(String method, String path, {Map<String, dynamic>? body, bool retry = true}) async {

    final token = await accessToken;

    final headers = {

      'Content-Type': 'application/json',

      if (token != null) 'Authorization': 'Bearer $token',

    };



    final uri = Uri.parse('$baseUrl$path');

    final res = await switch (method) {

      'GET' => http.get(uri, headers: headers),

      'POST' => http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null),

      'PUT' => http.put(uri, headers: headers, body: body != null ? jsonEncode(body) : null),

      _ => throw UnsupportedError(method),

    };



    if (res.statusCode == 401 && retry && token != null) {

      final refreshed = await _refreshAccessToken();

      if (refreshed) return _request(method, path, body: body, retry: false);

    }



    return _decode(res);

  }



  Future<bool> _refreshAccessToken() async {

    final refresh = await refreshToken;

    if (refresh == null) return false;



    try {

      final res = await http.post(

        Uri.parse('$baseUrl/auth/refresh'),

        headers: {'Content-Type': 'application/json'},

        body: jsonEncode({'refreshToken': refresh}),

      );

      if (res.statusCode >= 400) {

        await clearTokens();

        return false;

      }

      final data = jsonDecode(res.body) as Map<String, dynamic>;

      await saveTokens(data['accessToken'] as String, data['refreshToken'] as String);

      return true;

    } catch (_) {

      await clearTokens();

      return false;

    }

  }



  dynamic _decode(http.Response res) {

    final data = res.body.isEmpty ? null : jsonDecode(res.body);

    if (res.statusCode >= 400) {

      final message = data is Map ? (data['message']?.toString() ?? res.reasonPhrase ?? 'Error') : res.reasonPhrase ?? 'Error';

      throw ApiException(res.statusCode, message);

    }

    return data;

  }

}



class ApiException implements Exception {

  ApiException(this.statusCode, this.message);

  final int statusCode;

  final String message;



  @override

  String toString() => message;

}


