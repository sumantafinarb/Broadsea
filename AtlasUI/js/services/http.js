define(function(require, exports) {
  const ko = require('knockout');
  const config = require('appConfig');
  const sharedState = require('atlas-state');
  const { Api:OHDSIApi, STATUS } = require('ohdsi-api');
  const JSON_RESPONSE_TYPE = 'application/json';
  const TEXT_RESPONSE_TYPE = 'text/plain';
  const EventBus = require('services/EventBus');

    class Api extends OHDSIApi {

      get headers() {
        return {
          'User-Language': ko.unwrap(sharedState.locale),
        };
      }
    handleUnexpectedError() {
      console.error('Oooops!.. Something went wrong :(');
    }

    handleNotFoundError(responseJson) {
      if (responseJson !== undefined && responseJson.payload !== undefined) {
        EventBus.errorMsg(responseJson.payload.message);
      }
    }
		clearAllCookies () {
      const cookies = document.cookie.split(";");
    
      for (let cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      }
    
      sessionStorage.clear();
    };
    checkStatusError(response) {
      const status = response.status;

      if (status >= 200 && status < 300) {
        return true;
      }


      switch (status) {
         case STATUS.NOT_FOUND:
           this.handleNotFoundError(response.json);
           break;
        case STATUS.UNAUTHORIZED:
          localStorage.clear();

          this.clearAllCookies();
          this.handleUnauthorized(response.json);
          break;
        default:
          this.handleUnexpectedError();
          break;
      }

      return false;
    }
    getAzureAdToken() {
      const azureAdToken = localStorage.getItem('azureAd');
      return JSON.parse(azureAdToken).accessToken;
    }
    isSecureUrl(url) {
      var authProviders = config.authProviders.reduce(function(result, current) {
        result[config.api.url + current.url] = current;
        return result;
      }, {});

      return !authProviders[url] && url.startsWith(config.api.url);
    }

    getHeaders(requestUrl) {
      console.log(this.isSecureUrl(requestUrl),this.getAzureAdToken());
      if (this.isSecureUrl(requestUrl)) {
        const headers = super.getHeaders();
        headers['Action-Location'] = location;
        headers['Auth'] = `Bearer ${this.getAzureAdToken()}`;
        return headers;
      }
    
      return {};
    }

    sendRequest(method, path, payload) {
      const data = payload instanceof FormData
        ? payload
        : ko.toJS(payload);
      return super.sendRequest(method, path, data);
    }

    sendResult(res, parsedResponse) {
      return {
        ...super.sendResult(res, parsedResponse),
        data: parsedResponse,
        headers: res.headers,
      };
    }

    afterRequestHook(res) {
      if (!this.checkStatusError(res)) {
        throw res;
      }
      return res;
    }
  }

  class PlainTextApi extends Api {
    get headers() {
      return {
        'Accept': TEXT_RESPONSE_TYPE,
        'User-Language': ko.unwrap(sharedState.locale),
      };
    }

    parseResponse(text) {
      return text;
    }
  }

  const singletonApi = new Api();
  singletonApi.setAuthTokenHeader('Authorization');
  
  const plainTextService = new PlainTextApi();
  plainTextService.setAuthTokenHeader(singletonApi.AUTH_TOKEN_HEADER);  
  plainTextService.setUnauthorizedHandler(() => singletonApi.handleUnauthorized());
  plainTextService.setUserTokenGetter(() => singletonApi.getUserToken());

  singletonApi.plainTextService = plainTextService;

  return singletonApi;
});
