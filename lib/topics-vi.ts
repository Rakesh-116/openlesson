// ============================================
// STEM TOPIC CATALOGUE - Vietnamese
// Curated topics for tutoring sessions
// ============================================

export interface TopicCategory {
  name: string;
  emoji: string;
  topics: string[];
}

export const TOPIC_CATALOGUE: TopicCategory[] = [
  // ── MATHEMATICS ──────────────────────────────────
  {
    name: "Đại số & Lý thuyết số",
    emoji: "🔢",
    topics: [
      "Tại sao nhân hai số âm lại cho kết quả dương?",
      "Số phức là gì và tại sao chúng ta cần chúng?",
      "Số học modulo hoạt động như thế nào?",
      "Tại sao không thể chia cho 0?",
      "Điều gì khiến một số là số vô tỉ?",
      "Công thức nghiệm của phương trình bậc hai hoạt động như thế nào?",
      "Nhóm trong đại số trừu tượng là gì?",
      "Tại sao số nguyên tố lại quan trọng trong mật mã học?",
      "Trường trong toán học là gì?",
      "Logarit liên quan đến hàm mũ như thế nào?",
      "Vành trong đại số là gì và tại sao nó quan trọng?",
      "Chia đa thức dài hoạt động như thế nào?",
      "Định lý Fermat lớn nói về điều gì?",
      "Tại sao Định lý cơ bản của Đại số lại đúng?",
      "Giá trị riêng là gì và chúng đại diện cho điều gì?",
    ],
  },
  {
    name: "Giải tích & Vi tích phân",
    emoji: "📈",
    topics: [
      "Đạo hàm thực sự đo lường điều gì?",
      "Tại sao Định lý cơ bản của Giải tích lại quan trọng như vậy?",
      "Trực giác đằng sau tích phân là gì?",
      "Giới hạn hình thức hóa ý tưởng vô cực như thế nào?",
      "Chuỗi Taylor là gì và tại sao nó hoạt động?",
      "Tại sao e^(iπ) + 1 = 0?",
      "Định nghĩa epsilon-delta của giới hạn là gì?",
      "Quy tắc L'Hôpital hoạt động và khi nào có thể sử dụng nó?",
      "Đạo hàm riêng là gì và khi nào bạn cần chúng?",
      "Quy tắc dây chuyền hoạt động như thế nào theo trực giác?",
      "Biến đổi Fourier là gì và dùng để làm gì?",
      "Tại sao một số tích phân không có dạng đóng?",
      "Sự hội tụ và phân kỳ của chuỗi khác nhau như thế nào?",
      "Phương trình vi phân mô hình hóa các hiện tượng thực như thế nào?",
      "Biến đổi Laplace dùng để làm gì?",
    ],
  },
  {
    name: "Đại số tuyến tính",
    emoji: "📐",
    topics: [
      "Độc lập tuyến tính của các vectơ có nghĩa là gì?",
      "Tại sao ma trận hữu ích cho việc giải hệ phương trình?",
      "Không gian vectơ là gì?",
      "Nhân ma trận thực sự hoạt động như thế nào theo trực giác?",
      "Định thức là gì và nó cho bạn biết điều gì?",
      "Phân rã giá trị singular (SVD) là gì?",
      "Biến đổi tuyến tính liên quan đến ma trận như thế nào?",
      "Hạng của ma trận là gì?",
      "Tại sao ma trận trực giao lại quan trọng?",
      "Không gian null của ma trận là gì?",
      "PCA (phân tích thành phần chính) sử dụng đại số tuyến tính như thế nào?",
      "Tensor là gì và chúng tổng quát hóa ma trận như thế nào?",
    ],
  },
  {
    name: "Xác suất & Thống kê",
    emoji: "🎲",
    topics: [
      "Định lý Bayes là gì và tại sao nó quan trọng?",
      "Định lý giới hạn trung tâm là gì?",
      "Giá trị p thực sự hoạt động như thế nào?",
      "Sự khác biệt giữa tương quan và nhân quả là gì?",
      "Khoảng tin cậy thực sự nói gì?",
      "Ước lượng hợp lý cực đại hoạt động như thế nào?",
      "Luật số lớn là gì?",
      "Chuỗi Markov là gì?",
      "Kiểm định giả thuyết hoạt động như thế nào?",
      "Sự khác biệt giữa thống kê Bayes và tần số là gì?",
      "Phương pháp Monte Carlo là gì?",
      "Hồi quy tuyến tính tìm đường phù hợp nhất như thế nào?",
      "Nghịch lý ngày sinh và tại sao nó đáng ngạc nhiên?",
      "Entropy trong lý thuyết thông tin là gì?",
    ],
  },
  {
    name: "Hình học & Tôpô",
    emoji: "🔷",
    topics: [
      "Hình học phi Euclid là gì?",
      "Đa tạp là gì?",
      "Định lý Pythagoras tổng quát hóa sang chiều cao hơn như thế nào?",
      "Fractal là gì và tự tương tự có nghĩa là gì?",
      "Điều gì làm cho dải Möbius trở nên đặc biệt?",
      "Đặc trưng Euler là gì?",
      "Hình học hyperbolic khác với hình học phẳng như thế nào?",
      "Không gian tôpô là gì?",
      "Hai hình dạng đồng phôi có nghĩa là gì?",
      "Không gian xạ ảnh hoạt động như thế nào?",
    ],
  },
  {
    name: "Logic & Toán rời rạc",
    emoji: "🧩",
    topics: [
      "Chứng minh bằng phản chứng là gì?",
      "Quy nạp toán học hoạt động như thế nào?",
      "Định lý bất toàn của Gödel nói về điều gì?",
      "Sự khác biệt giữa bài toán NP và P là gì?",
      "Lý thuyết đồ thị mô hình hóa các mạng lưới thực tế như thế nào?",
      "Song ánh là gì và tại sao nó quan trọng?",
      "Vấn đề dừng là gì?",
      "Tổ hợp đếm các sắp xếp như thế nào?",
      "Đại số Boolean là gì?",
      "Nguyên lý lỗ thỏ là gì?",
    ],
  },

  // ── PHYSICS ──────────────────────────────────────
  {
    name: "Cơ học cổ điển",
    emoji: "⚙️",
    topics: [
      "Định luật thứ hai của Newton thực sự nói gì?",
      "Bảo toàn năng lượng hoạt động như thế nào?",
      "Sự khác biệt giữa khối lượng và trọng lượng là gì?",
      "Mô men động lượng hoạt động như thế nào?",
      "Phương pháp Lagrange trong cơ học là gì?",
      "Con quay hoạt động như thế nào để đứng thẳng?",
      "Nguyên lý tác dụng tối thiểu là gì?",
      "Lực thủy triều hoạt động như thế nào?",
      "Cơ học Hamilton là gì?",
      "Tại hiệu ứng Coriolis khiến bão xoáy?",
    ],
  },
  {
    name: "Điện từ học",
    emoji: "⚡",
    topics: [
      "Các phương trình Maxwell đang nói gì bằng ngôn ngữ đơn giản?",
      "Động cơ điện hoạt động như thế nào?",
      "Sóng điện từ là gì?",
      "Tụ điện lưu trữ năng lượng như thế nào?",
      "Mối quan hệ giữa điện và từ là gì?",
      "Cảm ứng điện từ hoạt động như thế nào?",
      "Trở kháng trong mạch xoay chiều là gì?",
      "Máy biến áp tăng điện áp như thế nào?",
      "Vectơ Poynting là gì?",
      "Antenn phát sóng điện từ như thế nào?",
    ],
  },
  {
    name: "Cơ học lượng tử",
    emoji: "⚛️",
    topics: [
      "Lưỡng tính sóng-hạt là gì?",
      "Nguyên lý bất định hoạt động như thế nào?",
      "Chồng chất lượng tử là gì?",
      "Phương trình Schrödinger mô tả điều gì?",
      "Vướng víu lượng tử là gì?",
      "Hiệu ứng đường hầm lượng tử hoạt động như thế nào?",
      "Vấn đề đo lường trong cơ học lượng tử là gì?",
      "Spin lượng tử và spinor là gì?",
      "Máy tính lượng tử sử dụng qubit như thế nào?",
      "Thí nghiệm hai khe cho chúng ta thấy điều gì?",
      "Sụp đổ hàm sóng là gì?",
      "Nguyên lý loại trừ Pauli giải thích bảng tuần hoàn như thế nào?",
    ],
  },
  {
    name: "Nhiệt động lực học",
    emoji: "🌡️",
    topics: [
      "Entropy là gì và tại sao nó luôn tăng?",
      "Động cơ nhiệt hoạt động như thế nào?",
      "Sự khác biệt giữa nhiệt và nhiệt độ là gì?",
      "Các định luật của nhiệt động lực học là gì?",
      "Chuyển pha là gì?",
      "Tủ lạnh di chuyển nhiệt từ lạnh sang nóng như thế nào?",
      "Phân bố Boltzmann là gì?",
      "Năng lượng tự do là gì và tại sao nó quan trọng?",
      "Cơ học thống kê kết nối với nhiệt động lực học như thế nào?",
      "Vật đen là gì và nó bức xạ như thế nào?",
    ],
  },
  {
    name: "Tương đối & Vũ trụ học",
    emoji: "🌌",
    topics: [
      "Tại sao không có gì có thể di chuyển nhanh hơn ánh sáng?",
      "E=mc² thực sự có nghĩa là gì?",
      "Hấp dẫn bẻ cong không-thời gian như thế nào?",
      "Hố đen là gì và nó hình thành như thế nào?",
      "Nghịch lý sinh đôi trong tương đối đặc biệt là gì?",
      "GPS phụ thuộc vào tương đối tổng quát như thế nào?",
      "Vật chất tối là gì và tại sao chúng ta nghĩ nó tồn tại?",
      "Năng lượng tối là gì?",
      "Điều gì đã xảy ra trong Vụ nổ lớn?",
      "Sóng hấp dẫn là gì?",
    ],
  },

  // ── COMPUTER SCIENCE ─────────────────────────────
  {
    name: "Thuật toán & Cấu trúc dữ liệu",
    emoji: "🌳",
    topics: [
      "Bảng băm hoạt động như thế nào bên dưới?",
      "Ký hiệu Big-O thực sự đo lường điều gì?",
      "Quicksort hoạt động như thế nào và tại sao nó nhanh?",
      "Quy hoạch động là gì?",
      "Cây tìm kiếm nhị phân cân bằng giữ cân bằng như thế nào?",
      "Duyệt đồ thị (BFS vs DFS) là gì?",
      "Thuật toán Dijkstra tìm đường đi ngắn nhất như thế nào?",
      "Sự khác biệt giữa ngăn xếp và hàng đợi là gì?",
      "Trie hoạt động cho việc khớp chuỗi như thế nào?",
      "Ghi nhớ và khi nào nên sử dụng nó?",
      "Bộ lọc Bloom hoạt động như thế nào?",
      "Độ phức tạp amortized là gì?",
    ],
  },
  {
    name: "Học máy & Trí tuệ nhân tạo",
    emoji: "🤖",
    topics: [
      "Tối ưu hóa gradient descent trong mạng nơron hoạt động như thế nào?",
      "Lan truyền ngược (backpropagation) là gì?",
      "Transformer và cơ chế attention hoạt động như thế nào?",
      "Overfitting là gì và làm thế nào để ngăn chặn nó?",
      "Mạng nơron tích chập nhận dạng hình ảnh như thế nào?",
      "Học tăng cường là gì?",
      "GAN tạo hình ảnh thực tế như thế nào?",
      "Sự đánh đổi bias-phương sai là gì?",
      "Cây quyết định và rừng ngẫu nhiên hoạt động như thế nào?",
      "Học chuyển giao là gì?",
      "Mô hình ngôn ngữ lớn tạo văn bản như thế nào?",
      "Vấn đề gradient biến mất là gì?",
      "Chuẩn hóa batch giúp huấn luyện như thế nào?",
      "Hàm mất mát là gì và làm thế nào để chọn một hàm?",
    ],
  },
  {
    name: "Hệ thống & Kiến trúc",
    emoji: "🖥️",
    topics: [
      "CPU thực thi lệnh như thế nào?",
      "Sự khác biệt giữa tiến trình và luồng là gì?",
      "Bộ nhớ ảo hoạt động như thế nào?",
      "Cache là gì và tại sao vị trí cache lại quan trọng?",
      "Hệ điều hành lên lịch tiến trình như thế nào?",
      "Deadlock là gì và làm thế nào để ngăn chặn nó?",
      "TCP đảm bảo dữ liệu được giao tin cậy như thế nào?",
      "Định lý CAP là gì?",
      "Chỉ mục cơ sở dữ liệu tăng tốc truy vấn như thế nào?",
      "Thuật toán đồng thuận phân tán (Raft, Paxos) là gì?",
      "Thu gom rác hoạt động như thế nào?",
      "Sự khác biệt giữa ACID và BASE là gì?",
    ],
  },
  {
    name: "Mật mã & Bảo mật",
    emoji: "🔐",
    topics: [
      "Mật mã khóa công khai (RSA) hoạt động như thế nào?",
      "Hàm băm là gì và điều gì làm cho nó an toàn?",
      "TLS/HTTPS giữ lưu lượng web riêng tư như thế nào?",
      "Chứng minh không kiến thức là gì?",
      "Blockchain hoạt động như thế nào?",
      "Chữ ký số là gì?",
      "Mã hóa AES hoạt động như thế nào?",
      "Tấn công man-in-the-middle là gì?",
      "Trao đổi khóa Diffie-Hellman hoạt động như thế nào?",
      "Thuật toán mật mã kháng lượng tử là gì?",
    ],
  },
  {
    name: "Ngôn ngữ lập trình & Lý thuyết",
    emoji: "💻",
    topics: [
      "Hệ thống kiểu là gì và tại sao nó quan trọng?",
      "Trình biên dịch chuyển mã thành lệnh máy như thế nào?",
      "Lập trình hàm là gì?",
      "Sự khác biệt giữa ngôn ngữ biên dịch và thông dịch là gì?",
      "Bộ thu gom rác quyết định giải phóng cái gì?",
      "Closure là gì và nó capture biến như thế nào?",
      "Calculus lambda là gì?",
      "Pattern matching hoạt động trong ngôn ngữ hàm như thế nào?",
      "Monad là gì và tại sao lập trình Haskell quan tâm?",
      "async/await và vòng lặp sự kiện hoạt động như thế nào?",
    ],
  },

  // ── BIOLOGY ──────────────────────────────────────
  {
    name: "Sinh học phân tử & Di truyền",
    emoji: "🧬",
    topics: [
      "Sao chép DNA hoạt động như thế nào?",
      "CRISPR là gì và chỉnh sửa gen hoạt động như thế nào?",
      "mRNA được dịch thành protein như thế nào?",
      "Epigenetics là gì?",
      "Đột biến thúc đẩy tiến hóa như thế nào?",
      "Mạng điều hòa gen là gì?",
      "PCR khuếch đại DNA như thế nào?",
      "Điều gì quyết định một gen là trội hay lặn?",
      "Cắt nối RNA hoạt động như thế nào?",
      "Dogma trung tâm của sinh học phân tử là gì?",
    ],
  },
  {
    name: "Sinh học tế bào & Hóa sinh",
    emoji: "🔬",
    topics: [
      "Hô hấp tế bào tạo ATP như thế nào?",
      "Cấu trúc và chức năng của màng tế bào là gì?",
      "Quang hợp chuyển đổi ánh sáng thành năng lượng như thế nào?",
      "Apoptosis (chết tế bào có lập trình) là gì?",
      "Enzyme xúc tác phản ứng như thế nào?",
      "Chu trình Krebs đang làm gì?",
      "Truyền tín hiệu trong tế bào hoạt động như thế nào?",
      "Gấp protein và tại sao nó quan trọng?",
      "Kháng thể nhận diện kháng nguyên như thế nào?",
      "Tế bào gốc là gì và chúng phân biệt như thế nào?",
    ],
  },
  {
    name: "Sinh thái học & Tiến hóa",
    emoji: "🌿",
    topics: [
      "Chọn lọc tự nhiên thúc đẩy tiến hóa như thế nào?",
      "Loài hình thành và nó xảy ra như thế nào?",
      "Hệ sinh thái duy trì cân bằng như thế nào?",
      "Lý thuyết cân bằng bị gián đoạn là gì?",
      "Drift di truyền khác với chọn lọc tự nhiên như thế nào?",
      "Điều gì gây ra các sự kiện tuyệt chủng hàng loạt?",
      "Lưới thức ăn mô hình hóa dòng năng lượng trong hệ sinh thái như thế nào?",
      "Giả thuyết Nữ hoàng Đỏ là gì?",
      "Cộng sinh tiến hóa như thế nào?",
      "Chọn lọc họ hàng và vị tha trong tiến hóa là gì?",
    ],
  },
  {
    name: "Khoa học thần kinh",
    emoji: "🧠",
    topics: [
      "Neuron bắn điện thế hoạt động như thế nào?",
      "Neuroplasticity là gì?",
      "Hình thành trí nhớ hoạt động như thế nào?",
      "Dẫn truyền thần kinh và chúng hoạt động như thế nào?",
      "Não xử lý thông tin thị giác như thế nào?",
      "Mạng chế độ mặc định là gì?",
      "Tăng cường dài hạn liên quan đến học tập như thế nào?",
      "Điều gì xảy ra trong não khi ngủ?",
      "Não biểu diễn ngôn ngữ như thế nào?",
      "Connectome là gì?",
    ],
  },

  // ── CHEMISTRY ────────────────────────────────────
  {
    name: "Hóa học tổng & Vật lý",
    emoji: "⚗️",
    topics: [
      "Liên kết hóa học là gì và tại sao các nguyên tử liên kết?",
      "Bảng tuần hoàn sắp xếp các nguyên tố như thế nào?",
      "Độ âm điện là gì?",
      "Cân bằng hóa học hoạt động như thế nào?",
      "Nguyên lý Le Chatelier là gì?",
      "Phản ứng axit-bazơ hoạt động như thế nào?",
      "Phản ứng oxi hóa-khử là gì?",
      "Động học phản ứng xác định tốc độ phản ứng như thế nào?",
      "Lực liên phân tử là gì?",
      "Năng lượng Gibbs tự do cho bạn biết điều gì về một phản ứng?",
    ],
  },
  {
    name: "Hóa học hữu cơ",
    emoji: "🧪",
    topics: [
      "Tính bất đối xứng và tại sao nó quan trọng trong sinh học?",
      "Cơ chế phản ứng hữu cơ hoạt động như thế nào?",
      "Tính thơm là gì?",
      "Phản ứng thế nucleophilic (SN1 vs SN2) hoạt động như thế nào?",
      "Nhóm carbonyl là gì và tại sao nó phản ứng mạnh?",
      "Polyme hình thành như thế nào?",
      "Hóa học lập thể là gì?",
      "Enzyme đạt được độ đặc hiệu cao như thế nào?",
      "Gốc tự do là gì và nó phản ứng như thế nào?",
      "Phân tích retrosynthesis lập kế hoạch tổng hợp như thế nào?",
    ],
  },

  // ── ENGINEERING ───────────────────────────────────
  {
    name: "Kỹ thuật điện",
    emoji: "🔌",
    topics: [
      "Transistor hoạt động như một công tắc như thế nào?",
      "Vòng phản hồi trong hệ thống điều khiển là gì?",
      "Bộ điều khiển PID hoạt động như thế nào?",
      "Xử lý tín hiệu và lọc là gì?",
      "Bộ chuyển đổi tương tự-số (ADC) hoạt động như thế nào?",
      "Định lý lấy mẫu Nyquist là gì?",
      "Op-amp hoạt động như thế nào?",
      "Máy trạng thái trong logic số là gì?",
      "MOSFET khác với BJT như thế nào?",
      "Ghép trở kháng và tại sao nó quan trọng?",
    ],
  },
  {
    name: "Kỹ thuật Cơ khí & Xây dựng",
    emoji: "🏗️",
    topics: [
      "Phân tích ứng suất và biến dạng hoạt động như thế nào?",
      "Phương pháp phần tử hữu hạn (FEA) là gì?",
      "Trao đổi nhiệt hoạt động như thế nào?",
      "Động lực học chất lỏng và phương trình Navier-Stokes là gì?",
      "Cầu phân bổ lực như thế nào?",
      "Mỏi vật liệu là gì?",
      "Turbine chuyển năng lượng chất lỏng thành quay như thế nào?",
      "Nguyên lý Bernoulli là gì?",
      "In 3D / Sản xuất bồi đắp hoạt động như thế nào?",
      "Số Reynolds và nó dự đoán điều gì?",
    ],
  },

  // ── EARTH & SPACE SCIENCE ────────────────────────
  {
    name: "Khoa học Trái đất & Khí hậu",
    emoji: "🌍",
    topics: [
      "Động lực mảng thúc đẩy trôi dạt lục địa như thế nào?",
      "Động đất gây ra như thế nào?",
      "Hiệu ứng nhà kính hoạt động như thế nào?",
      "Chu trình carbon là gì?",
      "Dòng hải lưu ảnh hưởng đến khí hậu như thế nào?",
      "Điều gì gây ra các kỷ băng hà?",
      "Định tuổi carbon phóng xạ hoạt động như thế nào?",
      "Chu trình nước và tại sao nó quan trọng?",
      "Núi lửa hình thành và phun trào như thế nào?",
      "Chu kỳ Milankovitch là gì?",
    ],
  },
  {
    name: "Thiên văn & Vật lý thiên văn",
    emoji: "🔭",
    topics: [
      "Sao hình thành và tiến hóa như thế nào?",
      "Sao neutron là gì?",
      "Chúng ta phát hiện ngoại hành tinh như thế nào?",
      "Sơ đồ Hertzsprung-Russell là gì?",
      "Tổng hợp hạt nhân cung cấp năng lượng cho Mặt Trời như thế nào?",
      "Siêu tân tinh là gì?",
      "Chúng ta đo khoảng cách vũ trụ như thế nào?",
      "Bức xạ nền vi sóng vũ trụ là gì?",
      "Thiên hà hình thành và tiến hóa như thế nào?",
      "Phương trình Drake ước tính gì?",
    ],
  },
];

/** Get a shuffled random selection of N topics (flat, from all categories) */
export function getRandomTopics(count: number): { topic: string; category: string; emoji: string }[] {
  const all: { topic: string; category: string; emoji: string }[] = [];
  for (const cat of TOPIC_CATALOGUE) {
    for (const topic of cat.topics) {
      all.push({ topic, category: cat.name, emoji: cat.emoji });
    }
  }
  // Fisher-Yates shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count);
}

/** Get one random topic per category */
export function getOnePerCategory(): { topic: string; category: string; emoji: string }[] {
  return TOPIC_CATALOGUE.map((cat) => {
    const topic = cat.topics[Math.floor(Math.random() * cat.topics.length)];
    return { topic, category: cat.name, emoji: cat.emoji };
  });
}
