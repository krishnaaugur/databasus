package databases

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

func DecryptWithClientKey(encryptedText, rawKey string) (string, error) {
	if !strings.HasPrefix(encryptedText, "enc:") {
		return encryptedText, nil
	}

	if rawKey == "" {
		return "", errors.New("credential field is encrypted with 'enc:', but no encryption key is available for this workspace or request")
	}

	cleanKey := strings.TrimPrefix(rawKey, "dbs_enc_")
	var keyBytes []byte
	var err error

	if len(cleanKey) == 64 {
		keyBytes, err = hex.DecodeString(cleanKey)
		if err != nil {
			return "", fmt.Errorf("failed to decode hex encryption key: %w", err)
		}
	} else if len(cleanKey) == 32 {
		keyBytes = []byte(cleanKey)
	} else if len(rawKey) == 32 {
		keyBytes = []byte(rawKey)
	} else {
		return "", fmt.Errorf("invalid encryption key length: expected 32-byte hex or string, got %d", len(rawKey))
	}

	parts := strings.Split(strings.TrimPrefix(encryptedText, "enc:"), ":")
	if len(parts) != 2 {
		return "", errors.New("invalid encrypted payload format, expected enc:<base64_nonce>:<base64_ciphertext>")
	}

	nonce, err := base64.StdEncoding.DecodeString(parts[0])
	if err != nil {
		return "", fmt.Errorf("failed to decode nonce: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	plaintextBytes, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt credentials with encryption key: %w", err)
	}

	return string(plaintextBytes), nil
}

func DecryptDatabaseSensitiveFields(database *Database, rawKey string) error {
	if database == nil {
		return nil
	}

	var err error

	if database.PostgresqlLogical != nil {
		if database.PostgresqlLogical.Password, err = DecryptWithClientKey(database.PostgresqlLogical.Password, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt postgresql password: %w", err)
		}

		if database.PostgresqlLogical.SshTunnel.Password, err = DecryptWithClientKey(database.PostgresqlLogical.SshTunnel.Password, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssh password: %w", err)
		}

		if database.PostgresqlLogical.SshTunnel.PrivateKey, err = DecryptWithClientKey(database.PostgresqlLogical.SshTunnel.PrivateKey, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssh private key: %w", err)
		}

		if database.PostgresqlLogical.SslClientKey, err = DecryptWithClientKey(database.PostgresqlLogical.SslClientKey, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssl client key: %w", err)
		}
	}

	if database.PostgresqlPhysical != nil {
		if database.PostgresqlPhysical.Password, err = DecryptWithClientKey(database.PostgresqlPhysical.Password, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt postgresql password: %w", err)
		}

		if database.PostgresqlPhysical.SshTunnel.Password, err = DecryptWithClientKey(database.PostgresqlPhysical.SshTunnel.Password, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssh password: %w", err)
		}

		if database.PostgresqlPhysical.SshTunnel.PrivateKey, err = DecryptWithClientKey(database.PostgresqlPhysical.SshTunnel.PrivateKey, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssh private key: %w", err)
		}

		if database.PostgresqlPhysical.SslClientKey, err = DecryptWithClientKey(database.PostgresqlPhysical.SslClientKey, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssl client key: %w", err)
		}
	}

	if database.Mysql != nil {
		if database.Mysql.Password, err = DecryptWithClientKey(database.Mysql.Password, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt mysql password: %w", err)
		}

		if database.Mysql.SshTunnel.Password, err = DecryptWithClientKey(database.Mysql.SshTunnel.Password, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssh password: %w", err)
		}

		if database.Mysql.SshTunnel.PrivateKey, err = DecryptWithClientKey(database.Mysql.SshTunnel.PrivateKey, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssh private key: %w", err)
		}
	}

	if database.Mariadb != nil {
		if database.Mariadb.Password, err = DecryptWithClientKey(database.Mariadb.Password, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt mariadb password: %w", err)
		}

		if database.Mariadb.SshTunnel.Password, err = DecryptWithClientKey(database.Mariadb.SshTunnel.Password, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssh password: %w", err)
		}

		if database.Mariadb.SshTunnel.PrivateKey, err = DecryptWithClientKey(database.Mariadb.SshTunnel.PrivateKey, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssh private key: %w", err)
		}
	}

	if database.Mongodb != nil {
		if database.Mongodb.Password, err = DecryptWithClientKey(database.Mongodb.Password, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt mongodb password: %w", err)
		}

		if database.Mongodb.SshTunnel.Password, err = DecryptWithClientKey(database.Mongodb.SshTunnel.Password, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssh password: %w", err)
		}

		if database.Mongodb.SshTunnel.PrivateKey, err = DecryptWithClientKey(database.Mongodb.SshTunnel.PrivateKey, rawKey); err != nil {
			return fmt.Errorf("failed to decrypt ssh private key: %w", err)
		}
	}

	return nil
}
