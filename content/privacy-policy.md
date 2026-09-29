---
title: "Privacy Policy"
description: "How the EH Lab app for iPhone and iPad, and the EH Lab web app, handle your information."
date: 2026-09-22
lastmod: 2026-09-29
---

**Last updated: September 29, 2026** · [中文版 ↓](#zh)

This policy explains how the **EH Lab** app for iPhone and iPad (listed on the App Store as "Extended Horizon Lab") and the EH Lab web app at [extendedhorizon.com/app](https://extendedhorizon.com/app/) (together, "the app") handle your information. Everything below applies to both, except where the section "On the web" says otherwise. The app is made for the members of the Extended Horizon Lab ("the lab", "we") in the Department of Computer Science at North Carolina State University, directed by Prof. Qiao (Georgie) Jin.

## In short

- The app is for lab members. It has no ads, no tracking and no analytics, and we never sell your information.
- We use your Google name and email address to check that you are on the lab's member list.
- When you borrow a device, your name and the dates go on the lab's equipment sheet, where other members can see them.
- Your questions in EH LLM, the tab for searching the lab's documents, go to the lab's own server and on to OpenAI (the iPhone and iPad app asks your permission first).
- If you choose to show your own meetings with the advisor, the app reads your calendar on your device only. Those events are never sent to the lab or anyone else.

## What the app handles and where it goes

### Signing in with Google

- You sign in on Google's own sign-in page. With your permission, Google gives the app your name, email address, Google account ID and basic profile, and permission to see events on public calendars.
- To check that you are on the lab's member list, the app sends a Google sign-in token, which contains your name, email address and Google account ID, to the lab's archive server. If you are on the list, the server issues a session for the app and keeps a record of it. **TODO — confirm with the server's code before publishing: "The server stores the session token only in hashed form." Delete this sentence if it is not true.**
- Each time you view or change the equipment list, the app sends your Google sign-in token to the lab's equipment service (a Google Apps Script run by the lab). The service asks Google to confirm the token and checks your email address against the member list.
- On your device, the app keeps your Google tokens and your lab session in the iOS Keychain.

### The lab calendar

- The lab calendar is a public Google Calendar. The app reads it from Google with the permission to see events on public calendars, and keeps a copy on your device so the schedule still shows when you are offline.

### Your own calendar (optional, off unless you turn it on)

- Only if you turn on **Show my meetings with the advisor** in Settings does the app ask Google for read-only access to your calendars. It then reads your primary calendar for meetings that include the lab's advisor.
- Those meetings are read directly from Google by the app on your device, shown only in the app on that device, and kept only in the app's memory while it runs. They are not saved to storage and are never sent to the lab's servers, to OpenAI or to anyone else.
- Turning the setting off stops the reading at once.

### Equipment

- When you borrow a device, the app writes the borrower's name, the time it was borrowed and the due date into that device's row on the lab's equipment sheet, a Google Sheet kept by the lab. When the device is returned, those cells are cleared.
- Lab members, and anyone else the lab shares the sheet with, can see who has which device. Earlier values can remain in the sheet's version history, which the sheet's editors can see.
- A lab member can record a loan for another member; that member's name is then written instead.

### EH LLM: searching and asking about lab documents

- When you use the EH LLM tab, your question is sent, with your session, to the lab's archive server, which the lab runs on Amazon Web Services (AWS) in the United States.
- **Find files:** the server sends your question to OpenAI to reword it for the search.
- **Ask:** the server sends your question and the matching passages from the lab's archive to OpenAI, which writes the answer.
- The iPhone and iPad app asks for your permission before any question is sent to OpenAI; if you do not agree, nothing is sent. The web app does not ask: a note under the question box says what is sent to OpenAI, and nothing is sent until you press Find files or Ask.
- The lab's archive server: **TODO — confirm and replace this sentence, for example "does not keep your questions after answering them" or "keeps request logs, including questions, for N days to fix problems, and then deletes them."**
- OpenAI processes this information to provide its service to the lab, under OpenAI's API terms and privacy policy. At the time of writing, OpenAI states that information sent through its API is not used to train its models unless the customer chooses to allow it, and may be kept for up to 30 days to detect abuse, or longer where the law requires. See [OpenAI's policies](https://openai.com/policies/).
- Your recent questions and answers (up to 50) are saved on your device so you can look at them again. They are excluded from device backups, deleted when you sign out, and can be cleared at any time in EH LLM → History.

### Settings on your device

- The app keeps your choice of language, answer language and calendar sharing on your device.

## On the web (extendedhorizon.com/app)

The web app does the same things as the iPhone and iPad app, with these differences:

- **Where it is kept:** the web app keeps your sign-in tokens, the lab session, the equipment session, the lab member list, a copy of the lab calendar, your recent EH LLM questions (up to 50) and your settings in your browser's local storage for extendedhorizon.com, not in the iOS Keychain. Signing out removes them. On a shared or public computer, always sign out when you finish.
- **Signing in:** Google gives the web app your name, email address, Google account ID and basic profile. It does not ask for calendar access at sign-in.
- **Equipment:** at sign-in the web app sends your Google sign-in token to the lab's equipment service once. The service checks it with Google and your address against the member list, then gives the web app its own session, which lasts up to 30 days, together with the lab's member list (names, email addresses and whether a headshot exists) so the app can show who has which device. Later requests use that session, and your membership is checked again each time.
- **Lab calendar:** the web app reads the public lab calendar from Google with the lab's own API key, so it needs no calendar permission from your account.
- **Your own calendar:** if you turn on Show my meetings with the advisor, Google gives the web app read-only access that lasts about an hour. When it has run out, the web app may briefly visit Google's page to renew it when it starts. The meetings are still kept only in memory and never sent anywhere.
- **Hosting:** the web app's files are served by GitHub Pages, which, like any web host, receives your IP address and browser information when your browser downloads them. The web app loads no third-party scripts, ads or trackers.

## What we don't do

- No advertising, no tracking across other companies' apps or websites, no analytics or crash-reporting services, and no selling or renting of your information.
- The app does not access your location, contacts, photos, camera, microphone or health data.
- The lab does not use your information to train AI models.

## Who can see your information

- **Other lab members:** your name on devices you have borrowed.
- **Lab managers** who look after the member list, the archive server and the equipment service: the member list, session records and server logs.
- **Service providers** that handle information for the lab: Google (sign-in, Google Calendar, the equipment sheet and the Apps Script service), Amazon Web Services (hosts the archive server), OpenAI (EH LLM questions) and GitHub (serves the web app's files). Each handles information under its own terms and privacy policy, and may process it outside the United States.
- **Others**, only when required by law or by North Carolina State University policy.

## How long information is kept

- **On your device:** until you sign out, clear the EH LLM history or delete the app. Sign out before deleting the app, so that its sign-in tokens are also removed from the iOS Keychain. On the web, until you sign out or clear the site's data in your browser.
- **Lab member list:** while you are a member of the lab. A lab manager removes you when you leave.
- **Archive server:** **TODO — confirm how long session records and server logs are kept, for example "sessions end when you sign out or after N days without use; logs are deleted after N days."**
- **Equipment sheet:** loan details until the device is returned; earlier values may remain in the sheet's version history.
- **Google, Amazon Web Services and OpenAI:** according to their own policies. The lab does not control how long they keep information.

## Your choices {#choices}

- **Stop reading your calendar:** turn off Show my meetings with the advisor in Settings.
- **Keep your questions away from OpenAI:** in the iPhone and iPad app, do not give the permission; on the web, do not press Find files or Ask; or do not use the EH LLM tab.
- **Clear EH LLM history:** EH LLM → History → Clear history.
- **Sign out:** Settings → Sign out.
- **Remove the app's access to your Google account:** go to [Google Account → Third-party connections](https://myaccount.google.com/connections). This signs the app out of Google on all of your devices; you will need to sign in again to use it.
- **Leave the member list, or ask what the lab holds about you and have it deleted:** contact us below. Loans of devices you still have stay on the sheet until the devices are returned.

## Children

The app is for members of a university research lab and is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have, contact us and we will delete it.

## Security

All connections use HTTPS. Sign-in tokens are kept in the iOS Keychain, or on the web in the browser's local storage for extendedhorizon.com. **TODO — keep "and the archive server stores session tokens only in hashed form" only if the server really does.** Only people on the lab's member list can use the archive server and the equipment service. No system is completely secure, but we take reasonable steps to protect your information.

## Google API Services

The app's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## Changes to this policy

If we change this policy, we will update this page and the date at the top, and tell lab members about significant changes.

## Contact

**Prof. Qiao (Georgie) Jin**<br>
Extended Horizon Lab<br>
Department of Computer Science, North Carolina State University<br>
1730 Varsity Dr, Raleigh, NC 27606, USA<br>
Email: [qjin4@ncsu.edu](mailto:qjin4@ncsu.edu)

<div lang="zh-Hans">

## 中文版 {#zh}

**最后更新：2026 年 9 月 29 日**

本政策说明 iPhone 和 iPad 版 **EH Lab** app（在 App Store 上的名称为 “Extended Horizon Lab”）以及 EH Lab 网页版（[extendedhorizon.com/app](https://extendedhorizon.com/app/)）（以下合称“本 app”）如何处理你的信息。除“网页版”一节另有说明外，以下内容同时适用于两者。本 app 是为北卡罗来纳州立大学计算机科学系 Extended Horizon Lab（以下简称“实验室”或“我们”，负责人为 Qiao (Georgie) Jin 教授）的成员制作的。

### 简要说明

- 本 app 供实验室成员使用。没有广告、没有跟踪、没有数据分析，我们绝不出售你的信息。
- 我们用你 Google 账号的姓名和邮箱，确认你在实验室的成员名单上。
- 你借用设备时，你的名字和借还日期会写进实验室的设备表格，其他成员可以看到。
- 你在 EH LLM（检索实验室资料的页面）里提的问题会发送到实验室自己的服务器，再发送给 OpenAI（iPhone 和 iPad 版会先征得你的同意）。
- 如果你选择显示自己与导师的会议，app 只在你的设备上读取你的日历，这些日程绝不会发送给实验室或任何其他人。

### 本 app 处理哪些信息、发送到哪里

#### 使用 Google 登录

- 你在 Google 自己的登录页面上登录。经你同意，Google 会向本 app 提供你的姓名、邮箱、Google 账号 ID 和基本资料，以及“查看公开日历上的活动”的权限。
- 为了确认你在实验室的成员名单上，app 会把 Google 登录令牌（其中包含你的姓名、邮箱和 Google 账号 ID）发送到实验室的资料库服务器。如果你在名单上，服务器会为 app 建立一个登录会话并保留记录。**TODO — 发布前对照服务器代码确认：“服务器只以哈希形式保存会话令牌。”如果不属实就删掉这句。**
- 每次查看或修改设备列表时，app 会把你的 Google 登录令牌发送到实验室的设备服务（由实验室运行的 Google Apps Script）。该服务会请 Google 验证令牌，并核对你的邮箱是否在成员名单上。
- 在你的设备上，app 把 Google 令牌和实验室登录会话保存在 iOS 钥匙串中。

#### 实验室日历

- 实验室日历是一个公开的 Google 日历。app 用“查看公开日历上的活动”的权限从 Google 读取，并在你的设备上保存一份副本，这样离线时也能看到日程。

#### 你自己的日历（可选，默认关闭）

- 只有当你在“设置”里打开 **显示我与导师的会议** 后，app 才会向 Google 申请只读访问你的日历，然后在你的主日历里查找有实验室导师参加的会议。
- 这些会议由你设备上的 app 直接从 Google 读取，只显示在这台设备上的 app 里，只在 app 运行时保存在内存中，不会存储到设备上，也绝不会发送到实验室的服务器、OpenAI 或任何其他人。
- 关闭这个设置后，app 会立即停止读取。

#### 设备借用

- 你借用设备时，app 会把借用人的名字、借出时间和应还日期写进实验室设备表格（由实验室维护的 Google 表格）中这台设备的那一行。设备归还后，这些格子会被清空。
- 实验室成员，以及实验室共享了这张表格的其他人，都能看到哪台设备在谁手上。之前的内容可能保留在表格的版本历史中，表格的编辑者可以看到。
- 实验室成员可以替另一位成员登记借用，这时写入的是那位成员的名字。

#### EH LLM：检索实验室资料和提问

- 使用 EH LLM 时，你的问题会连同你的登录会话一起发送到实验室的资料库服务器。这台服务器由实验室运行在位于美国的 Amazon Web Services（AWS）上。
- **搜索文件**：服务器把你的问题发送给 OpenAI，改写成检索用的词句。
- **提问**：服务器把你的问题和资料库中匹配到的段落发送给 OpenAI，由 OpenAI 写出回答。
- iPhone 和 iPad 版在任何问题发送给 OpenAI 之前都会先征得你的同意，你不同意就不会发送任何内容。网页版不单独询问：问题框下方的说明写明了哪些内容会发送给 OpenAI，只有在你点“搜索文件”或“提问”之后才会发送。
- 实验室的资料库服务器：**TODO — 请确认并替换这句话，例如“回答完成后不保存你的问题”，或“为排查问题会保存包含问题的请求日志 N 天，之后删除”。**
- OpenAI 按照其 API 条款和隐私政策，为实验室提供服务时处理这些信息。截至本文撰写时，OpenAI 表示通过其 API 发送的信息默认不会用于训练其模型（除非客户选择允许），并可能为检测滥用保留最多 30 天，法律要求时会保留更久。详见 [OpenAI 的政策](https://openai.com/policies/)。
- 你最近的问题和回答（最多 50 条）会保存在你的设备上，方便再次查看。这些内容不会进入设备备份，退出登录时会被删除，你也可以随时在“EH LLM → 历史记录”中清除。

#### 设备上的设置

- app 在你的设备上保存你选择的界面语言、回答语言，以及是否共享日历。

### 网页版（extendedhorizon.com/app）

网页版的功能和 iPhone、iPad 版相同，区别如下：

- **保存在哪里**：网页版把登录令牌、实验室登录会话、设备服务会话、实验室成员名单、实验室日历的副本、你最近在 EH LLM 里提的问题（最多 50 条）和你的设置，保存在浏览器里 extendedhorizon.com 的本地存储中，而不是 iOS 钥匙串。退出登录时会删除这些内容。在共用或公共电脑上，用完请务必退出登录。
- **登录**：Google 向网页版提供你的姓名、邮箱、Google 账号 ID 和基本资料。登录时不申请日历权限。
- **设备借用**：登录时，网页版会把你的 Google 登录令牌发送给实验室的设备服务一次。设备服务向 Google 验证令牌、核对你的邮箱是否在成员名单上，然后给网页版一个最长 30 天有效的会话，并提供实验室成员名单（姓名、邮箱，以及是否有头像），用来显示哪台设备在谁手上。之后的请求都使用这个会话，每次都会重新核对你是否仍是成员。
- **实验室日历**：网页版用实验室自己的 API 密钥从 Google 读取公开的实验室日历，不需要你的账号授予日历权限。
- **你自己的日历**：如果你打开“显示我与导师的会议”，Google 会给网页版约一小时有效的只读权限。过期后，网页版启动时可能会短暂跳转到 Google 页面续期。这些会议同样只保存在内存中，绝不会发送到任何地方。
- **托管**：网页版的文件由 GitHub Pages 提供。和所有网站托管一样，你的浏览器下载这些文件时，GitHub 会收到你的 IP 地址和浏览器信息。网页版不加载任何第三方脚本、广告或跟踪器。

### 我们不做的事

- 没有广告，不跨其他公司的 app 或网站跟踪你，没有数据分析或崩溃统计服务，不出售或出租你的信息。
- 本 app 不访问你的位置、通讯录、照片、相机、麦克风或健康数据。
- 实验室不会用你的信息训练 AI 模型。

### 谁能看到你的信息

- **其他实验室成员**：你借用的设备上显示的你的名字。
- **实验室管理员**（负责成员名单、资料库服务器和设备服务的人）：成员名单、登录会话记录和服务器日志。
- **为实验室处理信息的服务商**：Google（登录、Google 日历、设备表格和 Apps Script 服务）、Amazon Web Services（托管资料库服务器）、OpenAI（EH LLM 的问题）和 GitHub（提供网页版的文件）。它们各自按照自己的条款和隐私政策处理信息，并可能在美国以外的地方处理。
- **其他人**：仅在法律或北卡罗来纳州立大学的规定要求时。

### 信息保存多久

- **你的设备上**：直到你退出登录、清除 EH LLM 的历史记录或删除 app。删除 app 之前请先退出登录，这样登录令牌也会从 iOS 钥匙串中删除。网页版则保存到你退出登录，或在浏览器里清除本网站数据为止。
- **实验室成员名单**：在你是实验室成员期间。你离开实验室时，由实验室管理员把你移除。
- **资料库服务器**：**TODO — 请确认登录会话记录和服务器日志的保存时间，例如“退出登录或连续 N 天未使用后会话结束；日志在 N 天后删除”。**
- **设备表格**：借用信息保留到设备归还；之前的内容可能保留在表格的版本历史中。
- **Google、Amazon Web Services 和 OpenAI**：按照它们各自的政策。实验室无法控制它们保存信息的时间。

### 你的选择 {#choices-zh}

- **停止读取你的日历**：在“设置”中关闭“显示我与导师的会议”。
- **不让你的问题发送给 OpenAI**：在 iPhone 和 iPad 版中不给予同意；在网页版中不要点“搜索文件”或“提问”；或者不使用 EH LLM。
- **清除 EH LLM 的历史记录**：EH LLM → 历史记录 → 清除历史记录。
- **退出登录**：设置 → 退出登录。
- **撤销本 app 对你 Google 账号的访问权限**：前往 [Google 账号 → 第三方关联](https://myaccount.google.com/connections)。这会让你所有设备上的本 app 都退出 Google，之后需要重新登录才能使用。
- **退出成员名单，或询问实验室保存了你的哪些信息并要求删除**：请通过下方方式联系我们。你手上还没归还的设备，借用记录会留在表格里，直到设备归还。

### 儿童

本 app 面向大学研究实验室的成员，并非针对 13 岁以下的儿童。我们不会在知情的情况下收集 13 岁以下儿童的个人信息。如果你认为我们收集了，请联系我们，我们会删除。

### 安全

所有连接都使用 HTTPS。登录令牌保存在 iOS 钥匙串中；网页版则保存在浏览器里 extendedhorizon.com 的本地存储中。**TODO — 只有服务器确实这样做时，才保留“资料库服务器只以哈希形式保存会话令牌”。**只有成员名单上的人才能使用资料库服务器和设备服务。没有任何系统是绝对安全的，但我们会采取合理措施保护你的信息。

### Google API 服务

本 app 对从 Google API 获得的信息的使用和传输，遵守 [Google API 服务用户数据政策](https://developers.google.com/terms/api-services-user-data-policy)，包括其中的“有限使用”要求。

### 政策变更

如果我们修改本政策，会更新本页面和顶部的日期，重大变更会通知实验室成员。

### 联系我们

**金乔（Qiao (Georgie) Jin）教授**<br>
Extended Horizon Lab<br>
北卡罗来纳州立大学 计算机科学系<br>
1730 Varsity Dr, Raleigh, NC 27606, USA<br>
邮箱：[qjin4@ncsu.edu](mailto:qjin4@ncsu.edu)

</div>
