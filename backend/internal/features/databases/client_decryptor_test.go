package databases

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	postgresql_logical "databasus-backend/internal/features/databases/databases/postgresql/logical"
	"databasus-backend/internal/features/sshtunnel"
)

func encryptHelper(plaintext, rawKey string) (string, error) {
	cleanKey := hexKeyHelper(rawKey)
	keyBytes, err := hex.DecodeString(cleanKey)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	return fmt.Sprintf("enc:%s:%s",
		base64.StdEncoding.EncodeToString(nonce),
		base64.StdEncoding.EncodeToString(ciphertext),
	), nil
}

func hexKeyHelper(rawKey string) string {
	if len(rawKey) > 8 && rawKey[:8] == "dbs_enc_" {
		return rawKey[8:]
	}
	return rawKey
}

func Test_DecryptWithClientKey_PlaintextReturnedAsIs(t *testing.T) {
	result, err := DecryptWithClientKey("plain_password_123", "")
	require.NoError(t, err)
	assert.Equal(t, "plain_password_123", result)
}

func Test_DecryptWithClientKey_SuccessfulDecryption(t *testing.T) {
	keyBytes := make([]byte, 32)
	_, err := rand.Read(keyBytes)
	require.NoError(t, err)

	key := "dbs_enc_" + hex.EncodeToString(keyBytes)
	secretText := "super_secret_db_password_!@#"

	encrypted, err := encryptHelper(secretText, key)
	require.NoError(t, err)
	assert.Contains(t, encrypted, "enc:")

	decrypted, err := DecryptWithClientKey(encrypted, key)
	require.NoError(t, err)
	assert.Equal(t, secretText, decrypted)
}

func Test_DecryptWithClientKey_WhenKeyMissing_ReturnsError(t *testing.T) {
	_, err := DecryptWithClientKey("enc:YWJj:ZGVm", "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no encryption key is available")
}

func Test_DecryptWithClientKey_WhenTamperedCiphertext_ReturnsError(t *testing.T) {
	key := "dbs_enc_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	_, err := DecryptWithClientKey("enc:bm9uY2UxMjM0NTY3:dGFtcGVyZWRjaXBoZXI=", key)
	assert.Error(t, err)
}

func Test_DecryptDatabaseSensitiveFields_DecryptsAllEncryptedFields(t *testing.T) {
	keyBytes := make([]byte, 32)
	_, err := rand.Read(keyBytes)
	require.NoError(t, err)
	key := "dbs_enc_" + hex.EncodeToString(keyBytes)

	encPassword, err := encryptHelper("db_pass_123", key)
	require.NoError(t, err)

	encSshPass, err := encryptHelper("ssh_pass_456", key)
	require.NoError(t, err)

	database := &Database{
		Type: DatabaseTypePostgresLogical,
		PostgresqlLogical: &postgresql_logical.PostgresqlLogicalDatabase{
			Password: encPassword,
			SshTunnel: sshtunnel.Config{
				Password: encSshPass,
			},
		},
	}

	err = DecryptDatabaseSensitiveFields(database, key)
	require.NoError(t, err)

	assert.Equal(t, "db_pass_123", database.PostgresqlLogical.Password)
	assert.Equal(t, "ssh_pass_456", database.PostgresqlLogical.SshTunnel.Password)
}
