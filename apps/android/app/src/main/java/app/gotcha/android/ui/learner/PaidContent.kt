package app.gotcha.android.ui.learner

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.R
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter

/** UI-26: catalog item that costs money (API `isFree=false` with a price). */
fun ContentItem.isPaid(): Boolean = catalogPriceUzs() > 0.0 && (isFree == false || accessGranted != null)

/** Paid and not yet owned — opening it leads to the Reader paywall (Google Play purchase). */
fun ContentItem.isLocked(): Boolean = needsCatalogPayment()

/**
 * Price/lock badge for library cards. Locked → lock + price; owned paid book → "Owned".
 * Free items render nothing.
 */
@Composable
fun PaidBadge(item: ContentItem, modifier: Modifier = Modifier) {
    if (!item.isPaid()) return
    val locked = item.isLocked()
    val bg = if (locked) GotchaColors.WarningBg else GotchaColors.SuccessBg
    val fg = if (locked) GotchaColors.WarningText else GotchaColors.SuccessText
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        if (locked) Icon(Icons.Outlined.Lock, contentDescription = null, tint = fg, modifier = Modifier.size(11.dp))
        Text(
            if (locked) {
                formatSom(item.catalogPriceUzs())
            } else {
                stringResource(R.string.library_owned)
            },
            fontFamily = Inter,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp,
            color = fg,
            maxLines = 1,
        )
    }
}
