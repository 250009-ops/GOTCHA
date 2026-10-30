package app.gotcha.android

import java.io.File
import java.security.MessageDigest
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.w3c.dom.Element

/**
 * P3b.1 GOT-QA-P3b-01 (S1): Android 7.0 lacks ISRG Root X1, so the network security config must
 * trust the bundled ISRG Root X1 + X2 *and* the system store, for the base config and gotchaa.uz.
 */
class NetworkSecurityConfigTest {
    private val res = listOf(File("src/main/res"), File("app/src/main/res")).first { it.isDirectory }

    private val expected = mapOf(
        "isrg_root_x1" to "96BCEC06264976F37460779ACF28C5A7CFE8A3C0AAE11A8FFCEE05C0BDDF08C6",
        "isrg_root_x2" to "69729B8E15A86EFC177A57AFB7171DFC64ADD28C2FCA8CF1507E34453CCB1470",
    )

    @Test fun baseAndDomainConfigTrustSystemPlusBothIsrgRoots() {
        val doc = DocumentBuilderFactory.newInstance().newDocumentBuilder()
            .parse(File(res, "xml/network_security_config.xml"))
        for (tag in listOf("base-config", "domain-config")) {
            val cfg = doc.getElementsByTagName(tag).item(0) as Element
            val srcs = (0 until cfg.getElementsByTagName("certificates").length)
                .map { (cfg.getElementsByTagName("certificates").item(it) as Element).getAttribute("src") }
                .toSet()
            assertEquals("$tag anchors", setOf("system", "@raw/isrg_root_x1", "@raw/isrg_root_x2"), srcs)
            assertEquals("false", cfg.getAttribute("cleartextTrafficPermitted"))
        }
    }

    @Test fun manifestUsesTheConfig() {
        val manifest = File(res.parentFile, "AndroidManifest.xml").readText()
        assertTrue(manifest.contains("android:networkSecurityConfig=\"@xml/network_security_config\""))
    }

    @Test fun bundledRootsMatchPublishedSha256() {
        val cf = CertificateFactory.getInstance("X.509")
        for ((name, sha) in expected) {
            val cert = File(res, "raw/$name.pem").inputStream().use { cf.generateCertificate(it) as X509Certificate }
            val got = MessageDigest.getInstance("SHA-256").digest(cert.encoded).joinToString("") { "%02X".format(it) }
            assertEquals(name, sha, got)
            assertTrue(name, cert.subjectX500Principal.name.contains("ISRG Root X" + name.last()))
            assertEquals(cert.subjectX500Principal, cert.issuerX500Principal) // self-signed root
        }
    }
}
