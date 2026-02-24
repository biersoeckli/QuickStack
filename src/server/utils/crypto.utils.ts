import crypto from "crypto";

export class CryptoUtils {

    private static readonly ALGORITHM = 'aes-256-gcm';

    /**
     * Derives a 32-byte key from the NEXTAUTH_SECRET env var using SHA-256.
     */
    private static getKey(): Buffer {
        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) {
            throw new Error('NEXTAUTH_SECRET environment variable is not set.');
        }
        return crypto.createHash('sha256').update(secret).digest();
    }

    /**
     * Encrypts a plaintext string using AES-256-GCM.
     * @returns base64-encoded string in the format: iv:authTag:ciphertext
     */
    static encrypt(plaintext: string): string {
        const key = this.getKey();
        const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
        const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return [
            iv.toString('base64'),
            authTag.toString('base64'),
            encrypted.toString('base64'),
        ].join(':');
    }

    /**
     * Decrypts a string produced by {@link encrypt}.
     */
    static decrypt(ciphertext: string): string {
        const key = this.getKey();
        const [ivB64, authTagB64, encryptedB64] = ciphertext.split(':');
        if (!ivB64 || !authTagB64 || !encryptedB64) {
            throw new Error('Invalid ciphertext format.');
        }
        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');
        const encrypted = Buffer.from(encryptedB64, 'base64');
        const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        return decipher.update(encrypted) + decipher.final('utf-8');
    }


    /**
     * Generates a strong password that contains at least
     * one uppercase letter, one lowercase letter, one number, and one special character.
     * Valid length range: 10-72 characters.
     */
    static generateStrongPasswort(length = 35): string {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const special = '!$%*()-_+[]{},.';
        const all = uppercase + lowercase + numbers + special;

        // Guarantee at least one character from each required category
        const required = [
            uppercase[crypto.randomInt(uppercase.length)],
            lowercase[crypto.randomInt(lowercase.length)],
            numbers[crypto.randomInt(numbers.length)],
            special[crypto.randomInt(special.length)],
        ];

        const remaining = Array.from({ length: length - required.length }, () =>
            all[crypto.randomInt(all.length)]
        );

        const combined = [...required, ...remaining];

        // Fisher-Yates shuffle to avoid predictable positions
        for (let i = combined.length - 1; i > 0; i--) {
            const j = crypto.randomInt(i + 1);
            [combined[i], combined[j]] = [combined[j], combined[i]];
        }

        return combined.join('');
    }
}